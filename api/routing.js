let tables = {
    'rail': process.env.DB_RAIL_TABLE,
    'road': process.env.DB_ROAD_TABLE,
    'tram': process.env.DB_TRAM_TABLE
}

let configs = [
    // Rail
    {
        'maxWorstJumps': 50,
        'maxWorstJumpsWithTwoPoss': 70,
        'stopsFindRadius': 310,
        'subNetRadius': 100,
        'maxIterations': 50,
        'canReturn': true
    },
    // Road
    {
        'maxWorstJumps': 30,
        'maxWorstJumpsWithTwoPoss': 30,
        'stopsFindRadius': 100,
        'subNetRadius': 4,
        'maxIterations': 80,
        'canReturn': true
    },
    // Tram
    {
        'maxWorstJumps': 8,
        'maxWorstJumpsWithTwoPoss': 10,
        'stopsFindRadius': 200,
        'subNetRadius': 100,
        'maxIterations': 50,
        'canReturn': false
    }
]
let configIndex = 0;

let numOfIter = 0;
let numOfPoss = 0;

async function computeRoute(db, stops, layer) {
    let result = [];
    const start = Date.now();

    if (layer === 'rail') {
        configIndex = 0;
    } else if (layer === 'road') {
        configIndex = 1;
    } else {
        configIndex = 2;
    }

    stops = await getStopsData(db, stops);

    console.log('Routing stats')

    numOfIter = 0;
    numOfPoss = 0;

    let stopAIndex = 0;
    let stopBIndex = 1;
    let state = 0;
    let stepsBack = 0;
    let tempRoute = [];
 
    if (stops[stopBIndex] !== undefined && stops[stopBIndex].specCode === 'k') {
        state = 2;
    }
    while (-1 < stopAIndex && 0 < stopBIndex && //11 > stopBIndex &&
        stopAIndex < (stops.length - 1) && stopBIndex < stops.length) {
        if (stops[stopAIndex].geom === stops[stopBIndex].geom) {
            stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
            stopBIndex++;
            state = 1;
            continue;
        }

        if (stops[stopAIndex] === undefined || stops[stopBIndex] === undefined) {
            break;
        }

        let connection = await findConnection(db, stops[stopAIndex], stops[stopBIndex], layer);

        if (result.length > 1 && connection.length > 1) {
            if (result[result.length - 1] === connection[0] && result[result.length - 1] === connection[0] &&
                !configs[configIndex].canReturn) {
                connection = [];
            }
        }

        if (state === 0 && result.length === 0) {
            result = connection;
            state = 1;
        } else if (state === 1 && connection.length > 0) {
            result = addToRoute(result, connection);
        } else if (state === 1) {
            stopBIndex++;
            state = 10;
            stepsBack = 1;
        }

        console.log(state, connection.length);
        if (state === 1) {
            stopAIndex++;
            stopBIndex++;
        }

        if (state === 2) {
            if (connection.length > 0) {
                state = 3;
                result = addToRoute(result, connection);
                stopAIndex++;
                stopBIndex++;
            } else {
                state = 5;
                stopBIndex++;
            }
            continue;
        }

        if (state === 3) {
            if (connection.length > 0) {
                result = addToRoute(result, connection);
                result = addReversePoints(result, 0);
                stepsBack += 2;
            }
            state = 4;
            stopAIndex--;
            continue;
        }

        if (state === 4) {
            result = addReversePoints(result, stepsBack);
            stepsBack+=2;
            if (connection.length > 0) {
                state = 1;
                
                let duplicate = false;
                let i = result.length - 1;
                while (result[i] !== 's') {
                    i--;
                }

                if (connection.indexOf(result[i - 1]) !== -1 && connection.indexOf(result[i + 1]) !== -1) {
                    duplicate = true;
                }

                console.log(duplicate);

                if (duplicate) {
                    while(stepsBack > 2) {
                        result = removeHead(result);
                        stepsBack--;
                    }
                } else {
                    result = addToRoute(result, connection);
                }
                stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                stopBIndex++;
            } else {
                stopAIndex--;
                if (stopAIndex === -1) {
                    let steps = stepsBack;
                    while(steps > (stepsBack / 2)) {
                        result = removeHead(result);
                        steps--;
                    }
                    stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                    stopBIndex++;
                }
                continue;
            }
        }

        if (state === 5) {
            if (connection.length > 0) {
                state = 6;
                result = addToRoute(result, connection);
                stopAIndex++;
                stopBIndex = JSON.parse(JSON.stringify(stopAIndex)) + 1;
                stepsBack++;
            } else {
                stepsBack++;
                stopBIndex++;
            }
            continue;
        }

        if (state === 6) {
            if (connection.length > 0) {
                if (tempRoute.length === 0) {
                    tempRoute = connection;
                } else {
                    tempRoute = addToRoute(tempRoute, connection);
                }
                stepsBack--;
    
                if (stepsBack === 0) {
                    state = 1;
                    result = addToRouteFromEnd(result, tempRoute);
                    result = addToRoute(result, tempRoute);
                    stopAIndex++;
                    stopBIndex++;
                } else {
                    stopAIndex++;
                    stopBIndex++;
                    continue;
                }
            } else {
                state = 7;
                stopBIndex = JSON.parse(JSON.stringify(stopAIndex));
                stopAIndex--;
                stepsBack = 1;
                continue;
            }
        }

        if (state === 7) {
            if (connection.length > 0) {
                result = addToRouteOnPosition(result, connection, stepsBack);
                state = 1;
                stopBIndex++;
                stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                stopBIndex++;
            } else if (stopAIndex > 0) {
                stopAIndex--;
                stepsBack++;
                continue;
            } else {
                state = 8;
                stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                stopBIndex++;
                stepsBack = 0;
                continue;
            }
        }

        if (state === 8) {
            if (connection.length > 0) {
                tempRoute = connection;
                state = 1;
                stopAIndex++;
                stopBIndex = JSON.parse(JSON.stringify(stopAIndex));
                stopBIndex++;
                state = 9;
                continue;
            } else {
                stopBIndex++;
                stepsBack++;
            }
        }

        if (state === 9) {
            stopAIndex++;
            stopBIndex++;
            result = addToRoute(result, connection);

            if (stepsBack < 2) {
                result = addToRouteFromEnd(result, tempRoute);
                result = addToRoute(result, tempRoute);
                state = 1;
            } else {
                stepsBack--;
            }
        }

        if (state === 10) {
            if (connection.length > 0) {
                let nextPart;
                let goFurther = false;
                if (stops[stopBIndex + 1] !== undefined) {
                    nextPart = await findConnection(db, stops[stopBIndex], stops[stopBIndex + 1], layer);
                    if (connection[connection.length - 1] === nextPart[0] && connection[connection.length - 2] === nextPart[1]) {
                        goFurther = true;
                    }
                }

                if (!goFurther) {
                    state = 11;
                    result = addToRoute(result, connection);
                    stopBIndex = JSON.parse(JSON.stringify(stopAIndex));
                    stopBIndex++;
                    continue;
                }
            }
            stopBIndex++;
            stepsBack++;
        }

        if (state === 11) {
            if (connection.length > 0) {
                let nextPart;
                let goFurther = false;
                if (stops[stopAIndex - 1] !== undefined) {
                    nextPart = await findConnection(db, stops[stopAIndex], stops[stopAIndex - 1], layer);
                    if (connection[0] === nextPart[0] && connection[1] === nextPart[1]) {
                        goFurther = true;
                    }
                }

                if (!goFurther) {
                    tempRoute = connection;
                    state = 12;
                    stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                    stopBIndex++;
                    continue;
                }
                stopAIndex--;
            } else {
                stopAIndex--;
            }
        }

        if (state === 12) {
            if (connection.length > 0) {
                tempRoute = addToRoute(tempRoute, connection);
                if (stepsBack === 1) {
                    state = 1;
                    result = addToRouteFromEnd(result, tempRoute);
                    result = addToRoute(result, tempRoute);
                }
                stopAIndex++;
                stopBIndex++;
                stepsBack--;
            } else {
                stopBIndex++;
            }
        }

        if (state === 13) {
            if (connection.length > 0) {
                result = addToRoute(result, connection);
                state = 14;
                stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                stopAIndex--;
                continue;
            } else {
                break;
            }
        }

        if (state === 14) {
            if (connection.length > 0) {
                result = addToRouteFromEnd(result, connection);

                newPart = await findConnection(db, stops[stopAIndex - stepsBack], stops[stopAIndex], layer);
                if (newPart.length > 0) {
                    result = addToRouteFromEnd(result, newPart);
                    result = addToRoute(result, newPart);
                }

                result = addToRoute(result, connection);
            }
            if (stepsBack > 0) {
                state = 1;
                stopAIndex = JSON.parse(JSON.stringify(stopBIndex));
                stopBIndex++;
            } else {
                stopAIndex--;
                stepsBack--;
            }
        }

        if (state === 1 && stops[stopBIndex] !== undefined && stops[stopBIndex].specCode === 'k') {
            state = 2;
            stepsBack = 0;
            tempRoute = [];
        } else if (state === 1 && stops[stopBIndex] !== undefined && stops[stopBIndex].specCode === 'p') {
            state = 13;
            stepsBack = 0;
            while(stops[stopBIndex].specCode === 'p') {
                stopBIndex++;
                stepsBack++;
            }
        }
    }
    
    if (result.length < 1) {
        return [];
    }

    const end = Date.now();
    console.log(`Routing time: ${(end - start) / 1000} s`);
    
    return await decode(db, result, layer);
}

function addToRoute(result, newPart) {
    if (result[result.length - 2] === newPart[0] &&
        result[result.length - 1] === newPart[1]){
        newPart.splice(0, 2);
        result.push('s');
        result = result.concat(newPart);
    } else {
        newPart.splice(0, 1);
        result.push('s');
        result = result.concat(newPart);
    }

    return result;
}

function addToRouteFromEnd(result, newPart) {
    let i = newPart.length - 1;
    result.push('s');
    while (i > -1) {
        result.push(newPart[i]);
        i--;
    }

    return result;
}

function addReversePoints(result, stepsBack) {
    result.push('s');
    let i = result.length - 2;

    while (stepsBack > 0) {
        while (result[i] != 's' && i > -1) {
            i--;
        }
        stepsBack--;
        i--;
    }

    while (result[i] != 's' && i > -1) {
        result.push(result[i]);
        i--;
    }

    return result;
}

function addToRouteOnPosition(result, newPart, stepsBack) {
    result.push('s');
    let i = result.length - 2;

    while (stepsBack > 0) {
        while (result[i] != 's' && i > -1) {
            i--;
        }
        stepsBack--;
        i--;
    }

    let tmp = result.slice(i);
    result.splice(i);

    result = addToRoute(result, newPart);
    result = addToRouteFromEnd(result, newPart);
    result = addToRoute(result, tmp);

    return result;
}

function removeHead(result) {
    let i = result.length - 1;
    while (result[i] != 's' && i > -1) {
        result.splice(i, 1);
        i--;
    }
    result.splice(i, 1);

    return result;
}

async function findConnection(db, stopA, stopB, layer){
    let possibilities = await findInNet(db, stopA, layer, 'start');
    if (possibilities.length === 0) {
        return [];
    }

    let subNet = await getSubNet(db, layer, stopA, stopB);
    let endPosition = await findInNet(db, stopB, layer, 'end');

    if (endPosition.length === 0) {
        return [];
    }

    let j = 0;
    while (j < possibilities.length) {
        possibilities[j].toEnd = countDistance(subNet[possibilities[j].current].pos, stopB.pos);
        j++;
    }

    let bestToEnd = Infinity;
    let itersNum = 0;
    let possNum = possibilities.length;
    let finishedPossNum = 0;
    let visitedHubs = {};
    let minLength = Infinity;
    numOfPoss += possibilities.length;

    while (itersNum < configs[configIndex].maxIterations && finishedPossNum < possibilities.length) {
        itersNum++;
        numOfIter++;
        bestToEnd = Infinity;
        finishedPossNum = 0;

        j = 0;
        let curIndx = 0;
        possibilities.sort((a, b) => b.finished - a.finished || a.toEnd - b.toEnd || a.length - b.length || a.score - b.score);
        if (possibilities.length > 4 && itersNum % 5 === 0 && itersNum > 0) {
            possibilities.splice(4);
        }

        j = 0;
        while (j < possibilities.length) {
            if (!possibilities[j].finished && possibilities[j].length < bestToEnd) {
                bestToEnd = possibilities[j].length;
                curIndx = j;
            } else if (possibilities[j].finished) {
                finishedPossNum++;
            }
            j++;
        }

        if (finishedPossNum > 1) {
            break;
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
                    let pointA = subNet[possibilities[curIndx].visited[possibilities[curIndx].visited.length - 2]].pos;
                    let pointB = subNet[possibilities[curIndx].current].pos;
                    let pointC = subNet[nextHubs[k]].pos;

                    if (getAngle(pointA, pointB, pointC) < 1) {
                        nextHubs.splice(k, 1);
                    } else {
                        k++;
                    }
                }
            }

            if (nextHubs.length === 1) {
                possibilities[curIndx].current = nextHubs[0];

                possibilities[curIndx].toEnd = countDistance(subNet[possibilities[curIndx].current].pos, stopB.pos);
                if (possibilities[curIndx].lastToEnd < possibilities[curIndx].toEnd) {
                    possibilities[curIndx].numOfWorstJumps++;
                }

                possibilities[curIndx].lastToEnd = JSON.parse(JSON.stringify(possibilities[curIndx].toEnd));
                if (possibilities[curIndx].numOfWorstJumps > configs[configIndex].maxWorstJumps && possibilities.length > 2) {
                    nextHubs = [];
                } else if (possibilities[curIndx].numOfWorstJumps > configs[configIndex].maxWorstJumpsWithTwoPoss) {
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
        possibilities[curIndx].toEnd = countDistance(subNet[possibilities[curIndx].current].pos, stopB.pos);

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
            possibilities[possibilities.length - 1].toEnd = countDistance(subNet[nextHubs[k]].pos, stopB.pos);
            possibilities[possibilities.length - 1].current = nextHubs[k];
            numOfPoss ++;
            possNum ++;
        }
        possibilities[curIndx].length += countDistance(subNet[possibilities[curIndx].current].pos, subNet[nextHubs[0]].pos);
        possibilities[curIndx].toEnd = countDistance(subNet[nextHubs[0]].pos, stopB.pos);
        possibilities[curIndx].current = nextHubs[0];
    }
    console.log(numOfIter + '\t' + itersNum + '\t' + numOfPoss + '\t' + possNum);

    for (let j = 0; j < possibilities.length; j++) {
        possibilities[j].visited.push(possibilities[j].current);
    }

    possibilities.sort((a, b) => b.finished - a.finished || a.score - b.score || a.length - b.length);

    if (possibilities[0] !== undefined && possibilities[0].finished) {
        return possibilities[0].visited;
    } else {
        return [];
    }
}

async function getStopsData(db, stops) {
    for (let i = 0; i < stops.length; i++) {
        let stop;
        try {
            stop = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE geom='" + stops[i].geom + "'");
        } catch(err) {
            console.log(err);
            return false;
        }

        if (stop.rows === undefined) {
            stops[i] = undefined;
            continue;
        }

        if (stop.rows.length > 0) {
            stop.rows[0].pos = JSON.parse(stop.rows[0].st_asgeojson).coordinates;
            stop.rows[0].specCode = stops[i].specCode;
            delete stop.rows[0].st_asgeojson;
            stops[i] = stop.rows[0];
        }
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
        " WHERE ST_DistanceSphere(geom,'" + stop.geom + "') <= " + configs[configIndex].stopsFindRadius);
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
    } else if (result.length > 1) {
        if (result[0].score === result[1].score) {
            return [result[0], result[1]];
        } else {
            return [result[0]];
        }
    } else {
        return [result[0]];
    }
}

async function getSubNet(db, layer, stopA, stopB) {
    let response;
    let result = {};
    let centerPoint = [Math.abs(stopA.pos[0] + stopB.pos[0]) / 2, Math.abs(stopA.pos[1] + stopB.pos[1]) / 2];
    centerPoint = "'{" + '"type": "Point", "coordinates": ' + JSON.stringify(centerPoint) + "}'";

    try {
        response = await db.query("SELECT gid, conns, ST_AsGeoJSON(geom) FROM " + tables[layer] +
        " WHERE ST_DistanceSphere(geom, " + centerPoint + ") <= ST_DistanceSpheroid('" + stopA.geom + "'," + centerPoint + ") * " + configs[configIndex].subNetRadius);
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

    if (angleCAB > 1.63 || angleCBA > 1.63) {
        return Infinity;
    } else {
        return Math.min(Math.sin(angleCAB) * countDistance(point, edgeA), Math.sin(angleCBA) * countDistance(point, edgeB));
    }
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
        if (codes[i] === 's') {
            continue;
        }
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