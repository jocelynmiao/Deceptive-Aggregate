import os
import numpy as np
import pandas as pd
import xarray as xr
import gcsfs
import regionmask

SEASON_MONTHS = {
    "winter": [12, 1, 2],
    "spring": [3, 4, 5],
    "summer": [6, 7, 8],
    "fall": [9, 10, 11],
}


def seasonal_mean_global(ds_tas):
    da = ds_tas["tas"]

    da = da.assign_coords(
        lon=(((da.lon + 180) % 360) - 180)
    ).sortby("lon")

    weights = np.cos(np.deg2rad(da.lat))

    rows = []

    for season, months in SEASON_MONTHS.items():

        if season == "winter":
            da_s = da.sel(time=da.time.dt.month.isin(months))

            new_year = np.where(
                da_s.time.dt.month == 12,
                da_s.time.dt.year + 1,
                da_s.time.dt.year,
            )

            da_s = da_s.assign_coords(year=("time", new_year))
        else:
            da_s = da.sel(time=da.time.dt.month.isin(months))
            da_s = da_s.assign_coords(
                year=("time", da_s.time.dt.year.values)
            )

        grouped = (
            da_s.weighted(weights)
            .mean(dim=["lat", "lon"])
            .groupby("year")
            .mean()
        )

        for yr in grouped.year.values:
            rows.append(
                {
                    "year": int(yr),
                    "season": season,
                    "mean_temp": round(
                        float(grouped.sel(year=yr)) - 273.15,
                        4,
                    ),
                }
            )

    return pd.DataFrame(rows)


def seasonal_mean_countries(ds_tas):
    da = ds_tas["tas"]

    da = da.assign_coords(
        lon=(((da.lon + 180) % 360) - 180)
    ).sortby("lon")

    weights = np.cos(np.deg2rad(da.lat))

    world_regions = (
        regionmask.defined_regions
        .natural_earth_v5_0_0
        .countries_110
    )

    world = world_regions.to_geodataframe()

    mask = regionmask.mask_3D_geopandas(
        world,
        da.lon,
        da.lat,
    )

    total_weights = mask * weights

    rows = []

    for season, months in SEASON_MONTHS.items():

        if season == "winter":
            da_s = da.sel(time=da.time.dt.month.isin(months))

            new_year = np.where(
                da_s.time.dt.month == 12,
                da_s.time.dt.year + 1,
                da_s.time.dt.year,
            )

            da_s = da_s.assign_coords(year=("time", new_year))

        else:
            da_s = da.sel(time=da.time.dt.month.isin(months))
            da_s = da_s.assign_coords(
                year=("time", da_s.time.dt.year.values)
            )

        country_means = (
            da_s.weighted(total_weights)
            .mean(dim=["lat", "lon"])
        )

        grouped = country_means.groupby("year").mean()

        for yr in grouped.year.values:
            for ri in grouped.region.values:

                val = float(
                    grouped.sel(year=yr, region=ri)
                )

                if np.isnan(val):
                    continue

                rows.append(
                    {
                        "year": int(yr),
                        "season": season,
                        "country": world.loc[int(ri), "names"],
                        "mean_temp": round(
                            val - 273.15,
                            4,
                        ),
                    }
                )

    return pd.DataFrame(rows)


def filter_us(df_country):
    return df_country[
        df_country["country"]
        == "United States of America"
    ].copy()


def load_ssp245():
    catalog = pd.read_csv(
        "https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv"
    )

    matches = catalog[
        (catalog["experiment_id"] == "ssp245")
        & (catalog["variable_id"] == "tas")
        & (catalog["table_id"] == "Amon")
    ]

    if len(matches) == 0:
        raise RuntimeError("No SSP245 tas dataset found.")

    row = matches.iloc[0]

    print(
        f"Using {row['source_id']} "
        f"{row['member_id']}"
    )

    gcs = gcsfs.GCSFileSystem(token="anon")
    mapper = gcs.get_mapper(row["zstore"])

    return xr.open_zarr(
        mapper,
        consolidated=True,
    )


OUT = "data"
os.makedirs(OUT, exist_ok=True)

print("Loading SSP245 dataset...")
ds = load_ssp245()

print("Computing global seasonal temperatures...")
df_global = seasonal_mean_global(ds)

df_global.to_csv(
    f"{OUT}/seasonal_global_temp_ssp245.csv",
    index=False,
)

print("Saved seasonal_global_temp_ssp245.csv")

print("Computing country seasonal temperatures...")
df_country = seasonal_mean_countries(ds)

df_country.to_csv(
    f"{OUT}/seasonal_country_temp_ssp245.csv",
    index=False,
)

print("Saved seasonal_country_temp_ssp245.csv")

df_us = filter_us(df_country)

df_us.to_csv(
    f"{OUT}/seasonal_us_temp_ssp245.csv",
    index=False,
)

print("Saved seasonal_us_temp_ssp245.csv")

print("Done.")