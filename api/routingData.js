async function createStops(db, params) {
    if (params.stops === undefined) {
        return false;
    }

    let query = "";
    let data = JSON.parse(params.stops);
    let signsQuery = "";

    for (let i = 0; i < data.length; i++) {
        query += "(" + data[i].id + ", '" + data[i].n + "')";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }

        for (let j = 0; j < data[i].p.length; j++) {
            signsQuery += "(" + data[i].id + ", '" + data[i].p[j].n + "', '{" +
                '"type": "Point", "coordinates": ' + JSON.stringify(data[i].p[j].p) + "}')";
            
            if (data[i].p.length > 0 && j < (data[i].p.length - 1)) {
                signsQuery += ",";
            }
        }

        if (data[i].p.length > 0 && i < (data.length - 1)) {
            signsQuery += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + process.env.DB_STOPS_TABLE +
        ' (code, name) VALUES ' + query);
        await db.query("INSERT INTO " + process.env.DB_SIGNS_TABLE +
        ' (code, subCode, geom) VALUES ' + signsQuery);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function clearData(db) {
    try {
        await db.query("TRUNCATE TABLE " + process.env.DB_STOPS_TABLE + " RESTART IDENTITY");
        await db.query("TRUNCATE TABLE " + process.env.DB_SIGNS_TABLE + " RESTART IDENTITY");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getStopsInRad(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
        " WHERE ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 2000 " + 
        "ORDER BY ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + "))" +
        "LIMIT " + process.env.MAX_LOAD_POINTS * 3);

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];

            let name = await db.query("SELECT name FROM " + process.env.DB_STOPS_TABLE + " WHERE code=" + result.rows[i]['code']);
            if (name.rows[0] !== undefined) {
                result.rows[i]['name'] = name.rows[0].name;
            }
            delete result.rows[i]['id'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

module.exports = { createStops, clearData, getStopsInRad };