
import os
import numpy as np
import pandas as pd
import xarray as xr
import gcsfs
import regionmask

EXPERIMENTS = ["historical", "ssp245"]
 
SEASON_MONTHS = {
    "winter": [12, 1, 2],
    "summer": [6, 7, 8],
}
 
OUT = "data"
os.makedirs(OUT, exist_ok=True)

def load_cmip6_tas(experiment_id: str) -> xr.Dataset:
    catalog = pd.read_csv(
        "https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv"
    )
 
    matches = catalog[
        (catalog["experiment_id"] == experiment_id)
        & (catalog["variable_id"] == "tas")
        & (catalog["table_id"] == "Amon")
    ]
 
    if matches.empty:
        raise RuntimeError(f"No {experiment_id} tas dataset found in catalog.")
 
    row = matches.iloc[0]
    print(f"  [{experiment_id}] Using {row['source_id']} / {row['member_id']}")
 
    gcs = gcsfs.GCSFileSystem(token="anon")
    mapper = gcs.get_mapper(row["zstore"])
    return xr.open_zarr(mapper, consolidated=True)
 
 
def build_state_mask(da: xr.DataArray):
    us_states = regionmask.defined_regions.natural_earth_v5_0_0.us_states_50
    lon_norm = (((da.lon + 180) % 360) - 180).values
    mask = us_states.mask_3D(lon_norm, da.lat.values)   # (region, lat, lon)
    abbrevs = {i: us_states[i].abbrev for i in range(len(us_states))}
    names   = {i: us_states[i].name   for i in range(len(us_states))}
 
    return mask, abbrevs, names
 
 
def seasonal_mean_us_states(ds_tas: xr.Dataset) -> pd.DataFrame:
    da = ds_tas["tas"]
    da = da.assign_coords(
        lon=(((da.lon + 180) % 360) - 180)
    ).sortby("lon")
 
    lat_weights = np.cos(np.deg2rad(da.lat))   # (lat,)
    mask, abbrevs, names = build_state_mask(da)  # mask: (region, lat, lon)
    total_weights = mask * lat_weights           # (region, lat, lon)
 
    rows = []
 
    for season, months in SEASON_MONTHS.items():
        da_s = da.sel(time=da.time.dt.month.isin(months))
        if season == "winter":
            new_year = np.where(
                da_s.time.dt.month == 12,
                da_s.time.dt.year.values + 1,
                da_s.time.dt.year.values,
            )
        else:
            new_year = da_s.time.dt.year.values
 
        da_s = da_s.assign_coords(year=("time", new_year))
        state_ts = (
            da_s.weighted(total_weights)
                .mean(dim=["lat", "lon"]) 
        )
 
        grouped = state_ts.groupby("year").mean()
 
        for yr in grouped.year.values:
            for ri in grouped.region.values:
                val = float(grouped.sel(year=yr, region=ri))
                if np.isnan(val):
                    continue
                rows.append(
                    {
                        "year":        int(yr),
                        "season":      season,
                        "state_abbrev": abbrevs[int(ri)],
                        "state":       names[int(ri)],
                        "mean_temp_c": round(val - 273.15, 4),
                    }
                )
 
    df = pd.DataFrame(rows).sort_values(["year", "season", "state"]).reset_index(drop=True)
    return df

for exp in EXPERIMENTS:
    print(f"\nProcessing experiment: {exp}")
    ds = load_cmip6_tas(exp)
 
    print(f"  Computing state-level seasonal temperatures...")
    df = seasonal_mean_us_states(ds)
 
    out_path = os.path.join(OUT, f"seasonal_us_states_{exp}.csv")
    df.to_csv(out_path, index=False)
    print(f"  Saved → {out_path}  ({len(df):,} rows)")
 
print("\nDone.")