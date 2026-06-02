
import numpy as np
import pandas as pd
import xarray as xr
import gcsfs
import regionmask

SEASON_MONTHS = {
    "winter": [12, 1, 2],
    "spring": [3, 4, 5],
    "summer": [6, 7, 8],
    "fall":   [9, 10, 11],
}

def seasonal_mean_global(ds_tas):
    """
    Given an xarray Dataset with a 'tas' variable on (time, lat, lon),
    return a DataFrame with columns [year, season, mean_temp] in Celsius.
    Uses area weights (cos lat). Winter is DJF shifted so Dec belongs to
    the following meteorological year.
    """
    da = ds_tas["tas"]
    # normalise lons
    da = da.assign_coords(lon=(((da.lon + 180) % 360) - 180)).sortby("lon")
    weights = np.cos(np.deg2rad(da.lat))

    rows = []
    for season, months in SEASON_MONTHS.items():
        if season == "winter":
            # Use xarray's built-in DJF season grouping with shift
            da_djf = da.sel(time=da.time.dt.month.isin(months))
            # Shift December to the next year so groupby year gives correct DJF
            time_shifted = da_djf.time.to_index()
            # months==12 → add 1 year
            new_year = np.where(
                da_djf.time.dt.month == 12,
                da_djf.time.dt.year + 1,
                da_djf.time.dt.year
            )
            da_djf = da_djf.assign_coords(year=("time", new_year))
            grouped = da_djf.weighted(weights).mean(dim=["lat", "lon"]).groupby("year").mean()
        else:
            da_s = da.sel(time=da.time.dt.month.isin(months))
            da_s = da_s.assign_coords(year=("time", da_s.time.dt.year.values))
            grouped = da_s.weighted(weights).mean(dim=["lat", "lon"]).groupby("year").mean()

        for yr in grouped.year.values:
            val = float(grouped.sel(year=yr)) - 273.15
            rows.append({"year": int(yr), "season": season, "mean_temp": round(val, 4)})

    df = pd.DataFrame(rows).sort_values(["year", "season"]).reset_index(drop=True)
    return df


def seasonal_mean_countries(ds_tas):
    """
    Same but broken out per country using regionmask.
    Returns DataFrame [year, season, country, mean_temp].
    """
    da = ds_tas["tas"]
    da = da.assign_coords(lon=(((da.lon + 180) % 360) - 180)).sortby("lon")
    weights = np.cos(np.deg2rad(da.lat))

    world_regions = regionmask.defined_regions.natural_earth_v5_0_0.countries_110
    world = world_regions.to_geodataframe()
    mask = regionmask.mask_3D_geopandas(world, da.lon, da.lat)  # (region, lat, lon)
    total_weights = mask * weights  # broadcast-safe

    rows = []
    for season, months in SEASON_MONTHS.items():
        if season == "winter":
            da_s = da.sel(time=da.time.dt.month.isin(months))
            new_year = np.where(
                da_s.time.dt.month == 12,
                da_s.time.dt.year + 1,
                da_s.time.dt.year
            )
            da_s = da_s.assign_coords(year=("time", new_year))
        else:
            da_s = da.sel(time=da.time.dt.month.isin(months))
            da_s = da_s.assign_coords(year=("time", da_s.time.dt.year.values))

        # weighted mean over space for each country, then group by year
        country_means = da_s.weighted(total_weights).mean(dim=["lat", "lon"])
        grouped = country_means.groupby("year").mean()  # (year, region)

        for yr in grouped.year.values:
            for ri in grouped.region.values:
                val = float(grouped.sel(year=yr, region=ri)) - 273.15
                if np.isnan(val):
                    continue
                country_name = world.loc[int(ri), "names"]
                rows.append({
                    "year":     int(yr),
                    "season":   season,
                    "country":  country_name,
                    "mean_temp": round(val, 4),
                })

    df = pd.DataFrame(rows).sort_values(["country", "year", "season"]).reset_index(drop=True)
    return df


def filter_us(df_country):
    """Pull just the United States rows from a country-level DataFrame."""
    mask = df_country["country"].isin(["United States of America", "USA"])
    return df_country[mask].copy().reset_index(drop=True)


# ─── CMIP6 store loader (mirrors your notebook) ──────────────────────────────

def load_cmip6_store(experiment_id):
    """
    Returns an xarray Dataset for CESM2 / r1i1p1f1 / Amon / tas for the
    given experiment_id ('historical' or 'ssp245').
    Requires gcsfs + internet access.
    """
    catalog = pd.read_csv(
        "https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv"
    )
    if experiment_id == "historical":
        query = (
            "activity_id=='CMIP' & table_id=='Amon' & variable_id=='tas' & "
            "experiment_id=='historical' & source_id=='CESM2' & member_id=='r1i1p1f1'"
        )
    else:
        query = (
            f"activity_id=='ScenarioMIP' & table_id=='Amon' & variable_id=='tas' & "
            f"experiment_id=='{experiment_id}' & source_id=='CESM2' & member_id=='r1i1p1f1'"
        )
    row = catalog.query(query).iloc[0]
    gcs = gcsfs.GCSFileSystem(token="anon")
    mapper = gcs.get_mapper(row["zstore"])
    ds = xr.open_zarr(mapper, consolidated=True)
    return ds


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    OUT = "data"
    os.makedirs(OUT, exist_ok=True)

    for experiment in ["historical", "ssp245"]:
        print(f"\n{'='*60}")
        print(f"Loading {experiment} dataset …")
        ds = load_cmip6_store(experiment)
        print(f"  time range: {str(ds.time.values[0])[:7]} → {str(ds.time.values[-1])[:7]}")
        print(f"  shape: {ds.tas.shape}")

        # ── Global seasonal ─────────────────────────────────────────────────
        print(f"  Computing global seasonal means …")
        df_global_seasonal = seasonal_mean_global(ds)
        fname = f"{OUT}/seasonal_global_temp_{experiment}.csv"
        df_global_seasonal.to_csv(fname, index=False)
        print(f"  → saved {fname}  ({len(df_global_seasonal)} rows)")
        print(df_global_seasonal.head(8).to_string(index=False))

        # ── Country seasonal ─────────────────────────────────────────────────
        print(f"\n  Computing country-level seasonal means (slow ~5–15 min) …")
        df_country_seasonal = seasonal_mean_countries(ds)
        fname = f"{OUT}/seasonal_country_temp_{experiment}.csv"
        df_country_seasonal.to_csv(fname, index=False)
        print(f"  → saved {fname}  ({len(df_country_seasonal)} rows)")
        print(df_country_seasonal.head(8).to_string(index=False))

        # ── US seasonal ──────────────────────────────────────────────────────
        df_us_seasonal = filter_us(df_country_seasonal)
        fname = f"{OUT}/seasonal_us_temp_{experiment}.csv"
        df_us_seasonal.to_csv(fname, index=False)
        print(f"  → saved {fname}  ({len(df_us_seasonal)} rows)")
        print(df_us_seasonal.to_string(index=False))

    print("\nDone. Drop all CSVs into your project's  data/  directory.")
    print("Expected files:")
    for exp in ["historical", "ssp245"]:
        for scope in ["global", "country", "us"]:
            print(f"  data/seasonal_{scope}_temp_{exp}.csv")
