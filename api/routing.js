let tables = {
    'rail': process.env.DB_RAIL_TABLE,
    'road': process.env.DB_ROAD_TABLE,
    'tram': process.env.DB_TRAM_TABLE
}

async function computeRoute(db, stops, layer) {
    let result = [];

    stops = await getStopsData(db, stops);
    let maxIterations = 50;

    console.log('Routing stats')

    let numOfIter = 0;
    let numOfPoss = 0;
    let disconnected = false;
    for (let i = 0; i < stops.length - 1; i++) {
        let possibilities = await findInNet(db, stops[i], layer, 'start');
        if (possibilities.length === 0) {
            continue;
        }

        let subNet = await getSubNet(db, layer, stops[i], stops[i + 1]);
        let endPosition = await findInNet(db, stops[i + 1], layer, 'end');

        let j = 0;
        while (j < possibilities.length) {
            possibilities[j].toEnd = countDistance(subNet[possibilities[j].current].pos, stops[i + 1].pos);
            j++;
        }

        let bestToEnd = Infinity;
        let itersNum = 0;
        let possNum = possibilities.length;
        let finishedPossNum = 0;
        let visitedHubs = {};
        let minLength = Infinity;
        numOfPoss += possibilities.length;

        while (itersNum < maxIterations && finishedPossNum < possibilities.length) {
            itersNum++;
            numOfIter++;
            bestToEnd = Infinity;
            finishedPossNum = 0;

            j = 0;
            let curIndx = 0;
            while (j < possibilities.length) {
                if (possibilities[j].length > minLength + 100) {
                    possibilities.splice(j, 1);
                } else {
                    if (!possibilities[j].finished && possibilities[j].toEnd < bestToEnd) {
                        bestToEnd = possibilities[j].toEnd;
                        curIndx = j;
                    } else if (possibilities[j].finished) {
                        finishedPossNum++;
                    }
                    j++;
                }
            }

            let nextHubs = [];

            do {
                let lastPointCode = possibilities[curIndx].visited[possibilities[curIndx].visited.length - 1];
                possibilities[curIndx].length += countDistance(subNet[possibilities[curIndx].current].pos, subNet[lastPointCode].pos);

                // Check if current position is finish
                for (let k = 0; k < endPosition.length; k++) {
                    if (lastPointCode === endPosition[k].pointCodeA && possibilities[curIndx].current === endPosition[k].pointCodeB ||
                        lastPointCode === endPosition[k].pointCodeB && possibilities[curIndx].current === endPosition[k].pointCodeA ) {
                        possibilities[curIndx].finished = true;
                        possibilities[curIndx].score += JSON.parse(JSON.stringify(endPosition[k].score));
                        possibilities[curIndx].toEnd = 0;
                        finishedPossNum++;

                        if (minLength > possibilities[curIndx].length) {
                            minLength = possibilities[curIndx].length;
                        }
                        break;
                    }
                }

                // If we find the finish, there is no need to continue in search
                if (possibilities[curIndx].finished) {
                    break;
                }

                // Current hub actualization
                possibilities[curIndx].visited.push(possibilities[curIndx].current);
                // Find next hubs
                if (subNet[possibilities[curIndx].current] !== undefined) {
                    nextHubs = JSON.parse(JSON.stringify(subNet[possibilities[curIndx].current].conns));
                } else {
                    nextHubs = [];
                }

                // Remove reverse way possibilities
                if (nextHubs.indexOf(possibilities[curIndx].visited[possibilities[curIndx].visited.length - 2]) !== -1) {
                    nextHubs.splice(nextHubs.indexOf(possibilities[curIndx].visited[possibilities[curIndx].visited.length - 2]), 1);
                }

                // Remove hubs, which are out of current map
                let k = 0;
                while (k < nextHubs.length) {
                    if (subNet[nextHubs[k]] === undefined) {
                        nextHubs.splice(k, 1);
                    } else {
                        k++;
                    }
                }

                if (nextHubs.length === 1) {
                    possibilities[curIndx].current = nextHubs[0];

                    possibilities[curIndx].toEnd = countDistance(subNet[possibilities[curIndx].current].pos, stops[i + 1].pos);
                    if (possibilities[curIndx].lastToEnd < possibilities[curIndx].toEnd) {
                        possibilities[curIndx].numOfWorstJumps++;
                    }

                    possibilities[curIndx].lastToEnd = JSON.parse(JSON.stringify(possibilities[curIndx].toEnd));
                    if (possibilities[curIndx].numOfWorstJumps > 2 && minLength < Infinity) {
                        nextHubs = [];
                    }
                }
            } while (nextHubs.length === 1 && !possibilities[curIndx].finished);

            // If we find the finish, there is no need to continue in search
            if (possibilities[curIndx].finished) {
                continue;
            }

            if (nextHubs.length === 0) {
                possibilities.splice(curIndx, 1);
                continue;
            }

            // Count new distance to finish
            possibilities[curIndx].toEnd = countDistance(subNet[possibilities[curIndx].current].pos, stops[i + 1].pos);

            // If there is an possibility with better score, remove current possibility
            if (visitedHubs[possibilities[curIndx].current] !== undefined && visitedHubs[possibilities[curIndx].current] <= possibilities[curIndx].length) {
                possibilities.splice(curIndx, 1);
                continue;
            } else {
                visitedHubs[possibilities[curIndx].current] = possibilities[curIndx].length;
            }

            // Save new possibilities and distances to finish position
            for (let k = 1; k < nextHubs.length; k++) {
                possibilities.push(JSON.parse(JSON.stringify(possibilities[curIndx])));
                possibilities[possibilities.length - 1].length += countDistance(subNet[possibilities[curIndx].current].pos, subNet[nextHubs[k]].pos);
                possibilities[possibilities.length - 1].toEnd = countDistance(subNet[nextHubs[k]].pos, stops[i + 1].pos);
                possibilities[possibilities.length - 1].current = nextHubs[k];
                numOfPoss ++;
                possNum ++;
            }
            possibilities[curIndx].length += countDistance(subNet[possibilities[curIndx].current].pos, subNet[nextHubs[0]].pos);
            possibilities[curIndx].toEnd = countDistance(subNet[nextHubs[0]].pos, stops[i + 1].pos);
            possibilities[curIndx].current = nextHubs[0];
        }
        console.log(i + ':\t' + numOfIter + '\t' + itersNum + '\t' + numOfPoss + '\t' + possNum);

        possibilities.sort((a, b) => b.finished - a.finished || a.score - b.score || a.endScore - b.endScore || a.length - b.length);
        if (result.length === 0 && possibilities.length > 0 && possibilities[0].finished) {
            result.push({'score': JSON.parse(JSON.stringify(possibilities[0].score)),
                'visited': JSON.parse(JSON.stringify(possibilities[0].visited)),
                'length': JSON.parse(JSON.stringify(possibilities[0].length))})
        } else {
            let k = 0;
            disconnected = true;
            for (let j = 0; j < possibilities.length; j++) {
                if (possibilities[j].finished) {
                    k = 0;
                    while (k < result.length) {
                        if (result[k].visited[result[k].visited.length - 1] === possibilities[j].visited[0]) {
                            disconnected = false;
                        }
                        k++;
                    }
                }
            }

            for (let j = 0; j < possibilities.length; j++) {
                if (possibilities[j].finished) {
                    k = 0;
                    while (k < result.length) {
                        if (result[k].visited[result[k].visited.length - 1] === possibilities[j].visited[0]) {
                            result.push(JSON.parse(JSON.stringify(result[k])));
                            result[result.length - 1].score += possibilities[j].score;
                            result[result.length - 1].visited = result[result.length - 1].visited.concat(possibilities[j].visited);
                            result[result.length - 1].length += possibilities[j].length;

                            if (i === stops.length - 2) {
                                result[result.length - 1].visited.push(possibilities[j].current);
                            }

                            result.splice(k, 1);
                        } else {
                            if (disconnected) {
                                result[result.length - 1].visited = result[result.length - 1].visited.concat(possibilities[j].visited);
                            }
                            k++;
                        }
                    }
                }
            }
        }
    }

    console.log(result.length);
    if (result.length < 1) {
        return [];
    } else {
        result.sort((a, b) => a.score - b.score);
    }
    
    return await decode(db, result[0].visited, layer);
}

async function getStopsData(db, stops) {
    for (let i = 0; i < stops.length; i++) {
        let stop;
        try {
            stop = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE geom='" + stops[i] + "'");
        } catch(err) {
            console.log(err);
            return false;
        }

        if (stop.rows === undefined) {
            stops[i] = undefined;
            continue;
        }

        stop.rows[0].pos = JSON.parse(stop.rows[0].st_asgeojson).coordinates;
        delete stop.rows[0].st_asgeojson;
        stops[i] = stop.rows[0];
    }

    let i = 1;
    while (i < stops.length) {
        if (stops[i - 1].id === stops[i].id) {
            stops.splice(i, 1);
        } else {
            i++;
        }
    }

    return stops;
}

async function findInNet(db, stop, layer, mode) {
    let response;
    try {
        response = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[layer] +
        " WHERE ST_DistanceSphere(geom,'" + stop.geom + "') <= 300 ");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (response.rows === undefined || response.rows.length < 1) {
        return [];
    }

    let gids = {};
    let lines = {};
    for (let i = 0; i < response.rows.length; i++) {
        gids[response.rows[i].gid] = response.rows[i];
        for (let j = 0; j < response.rows[i].conns.length; j++) {
            let key = response.rows[i].gid + '_' + response.rows[i].conns[j];
            if (mode === 'start') {
                lines[key] = {'pointCodeA': response.rows[i].gid,
                'current': response.rows[i].conns[j],
                'score': 0,
                'length': 0,
                'toEnd': 0,
                'finished': false,
                'visited': [response.rows[i].gid],
                'lastToEnd': Infinity,
                'numOfWorstJumps': 0};
            } else {
                lines[key] = {'pointCodeA': response.rows[i].gid,
                    'pointCodeB': response.rows[i].conns[j],
                    'score': 0};
            }
        }
    }

    let result = [];
    let keys = Object.keys(lines);

    for (let i = 0; i < keys.length; i++) {
        let pointA = gids[lines[keys[i]].pointCodeA];
        let pointB = gids[lines[keys[i]].current];

        if (mode === 'end') {
            pointB = gids[lines[keys[i]].pointCodeB];
        }

        if (pointA === undefined || pointB === undefined) {
            continue;
        }

        pointA = JSON.parse(pointA.st_asgeojson).coordinates;
        pointB = JSON.parse(pointB.st_asgeojson).coordinates;

        lines[keys[i]].score = triangulation(pointA, pointB, stop.pos);
        if (lines[keys[i]].score < Infinity) {
            if (mode === 'start') {
                delete lines[keys[i]].pointCodeA;
            }

            result.push(lines[keys[i]]);
        }
    }

    result.sort((a, b) => a.score - b.score);

    if (result.length < 1) {
        return [];
    } else if (result.length < 2) {
        return [result[0]];
    } else {
        return [result[0], result[1]];
    }
}

async function getSubNet(db, layer, stopA, stopB) {
    let response;
    let result = {};
    let centerPoint = [Math.abs(stopA.pos[0] + stopB.pos[0]) / 2, Math.abs(stopA.pos[1] + stopB.pos[1]) / 2];
    centerPoint = "'{" + '"type": "Point", "coordinates": ' + JSON.stringify(centerPoint) + "}'";

    try {
        response = await db.query("SELECT gid, conns, ST_AsGeoJSON(geom) FROM " + tables[layer] +
        " WHERE ST_DistanceSphere(geom, " + centerPoint + ") <= ST_DistanceSpheroid('" + stopA.geom + "'," + centerPoint + ") * 100");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (response.rows === undefined || response.rows.length < 1) {
        return {};
    }

    for (let i = 0; i < response.rows.length; i++) {
        result[response.rows[i].gid] = {'pos': JSON.parse(response.rows[i].st_asgeojson).coordinates, 'conns': response.rows[i].conns}
    }

    return result;
}

function triangulation(edgeA, edgeB, point) {
    let angleCAB = getAngle(point, edgeA, edgeB);
    let angleCBA = getAngle(point, edgeB, edgeA);

    if (angleCAB > 1.61 || angleCBA > 1.61) {
        return Infinity;
    } else {
        return Math.min(Math.sin(angleCAB) * countDistance(point, edgeA), Math.sin(angleCBA) * countDistance(point, edgeB));
    }

    /*
    } else if (angleCAB > 1.61) {
        return Math.sin(angleCBA) * countDistance(point, edgeB);
    } else if (angleCBA > 1.61) {
        return Math.sin(angleCAB) * countDistance(point, edgeA);
    */
}

function countDistance(pointA, pointB) {
    // Výpočet vzdialenosti pomocou Haversine formuly
    const R = 6371e3;
    let lat_1_rad = pointA[0] * Math.PI / 180;
    let lat_2_rad = pointB[0] * Math.PI / 180;
    let delta_1 = (pointB[0] - pointA[0]) * Math.PI / 180;
    let delta_2 = (pointB[1] - pointA[1]) * Math.PI / 180;

    let a = Math.sin(delta_1 / 2) * Math.sin(delta_1 / 2) + Math.cos(lat_1_rad) * Math.cos(lat_2_rad) *
        Math.sin(delta_2 / 2) * Math.sin(delta_2 / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return(R * c);
}

function getAngle(x, y, z) {
    let x_y = Math.sqrt(Math.pow(y[0] - x[0], 2)+ Math.pow(y[1] - x[1], 2));
    let y_z = Math.sqrt(Math.pow(y[0] - z[0], 2)+ Math.pow(y[1] - z[1], 2));
    let x_z = Math.sqrt(Math.pow(z[0] - x[0], 2)+ Math.pow(z[1] - x[1], 2));

    return Math.acos((y_z * y_z + x_y * x_y - x_z * x_z) / (2 * y_z * x_y));
}

async function decode(db, codes, layer) {
    let result = [];
    for (let i = 0; i < codes.length; i++) {
        try {
            response = await db.query("SELECT geom, ST_AsGeoJSON(geom) FROM " + tables[layer] +
            " WHERE gid=" + codes[i]);
        } catch(err) {
            console.log(err);
            return false;
        }

        if (response.rows === undefined) {
            continue;
        }

        result.push(JSON.parse(response.rows[0].st_asgeojson).coordinates);
    }

    return result;
}

module.exports = { computeRoute };