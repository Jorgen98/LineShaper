let tables = {
    'rail': process.env.DB_RAIL_TABLE,
    'road': process.env.DB_ROAD_TABLE,
    'tram': process.env.DB_TRAM_TABLE
}

async function getPoint(db, params) {
    let result;
    if (params.gid === undefined || params.gid === "") {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "'");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (result.rows.length !== 1) {
        return false;
    }
    result = result.rows[0];
    result['geom'] = JSON.parse(result['st_asgeojson']).coordinates;
    delete result['st_asgeojson'];

    return result;
}

async function createPoint(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.conns === undefined) {
        return false;
    }

    let point = "'{" + '"type": "Point", "coordinates": ' + params.geom + "}'";

    params.conns += "::integer[]";

    try {
        let gid = await db.query("INSERT INTO " + tables[params.layer] +
        ' (geom, conns) VALUES (' + point + ", ARRAY " + params.conns + ") RETURNING gid");
        return gid.rows[0];
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function createPoints(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.hubs === undefined) {
        return false;
    }

    let query = "";
    let data = JSON.parse(params.hubs);

    for (let i = 0; i < data.length; i++) {
        if (data[i]["p"] === undefined) {
            continue;
        }
    
        if (data[i]["n"] === undefined) {
            continue;
        }
    
        let point = "('{" + '"type": "Point", "coordinates": ' + JSON.stringify(data[i]["p"]) + "}'";
        query += point + ", ARRAY " + JSON.stringify(data[i]["n"]) + "::integer[])";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + tables[params.layer] +
        ' (geom, conns) VALUES ' + query);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function updatePoint(db, params) {
    if (params.gid === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    let query = "";
    if (params.geom !== undefined) {
        query += "geom='{" + '"type": "Point", "coordinates": ' + params.geom + "}'";
    }

    if (params.conns !== undefined) {
        if (params.geom !== undefined) {
            query += ",";
        }
        query += "conns=ARRAY " + params.conns + "::integer[]";
    }

    try {
        await db.query("UPDATE " + tables[params.layer] + " SET " + query + " WHERE gid='" + params.gid + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function deletePoint(db, params) {
    if (params.gid === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    try {
        await db.query("DELETE FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getPointsInRad(db, params) {
    if (tables[params.layer] === undefined || params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] +
        " WHERE ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 400");

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i] = result.rows[i];
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function deleteLayer(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        await db.query("TRUNCATE TABLE " + tables[params.layer] + " RESTART IDENTITY");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getPointsByGID(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.gid === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] +
        " WHERE gid > " + params.gid + " LIMIT 1000");

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i] = result.rows[i];
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getStats(db) {
    let stats = {};
    let keys = Object.keys(tables);

    for (let i = 0; i < 3; i++) {
        try {
            let result = await db.query("SELECT COUNT(gid) FROM " + tables[keys[i]]);
            stats[keys[i]] = parseInt(result.rows[0].count);
        } catch(err) {
            console.log(err);
            return false;
        }
    }
    
    return stats;
}

module.exports = { getPoint, createPoint, updatePoint, deletePoint, getPointsInRad, getStats, deleteLayer, getPointsByGID, createPoints };