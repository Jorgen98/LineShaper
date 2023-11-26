import { Component } from '@angular/core';
import * as L from 'leaflet';
import { MapService } from './map.service';
import { DataService } from '../data.service';

@Component({
    selector: 'map-component',
    templateUrl: './map.html',
    styleUrls: ['./map.css']
})

export class MapComponent {
    private map!: L.Map;
    private tiles = {
        "min_zoom": 7,
        "max_zoom": 19,
        "tiles": [
        {
            "layer": 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
        {
            "layer": 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
            "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
        {
            "layer": 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            "attribution": '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        ]
    };
    private curObjects: any = {};
    private curConns: any = {};
    private layers: any = {
        'points': undefined,
        'lines': undefined,
        'background': undefined
    }

    private editMode = "mouse";
    private acPoint: any = undefined;
    private acLine: any = undefined;
    private acPopUp: any = undefined;
    private newPoints: any = [];

    private initMap(): void {
        this.map = L.map('map', {
            center: [49.195629, 16.613396],
            zoom: 13,
            zoomControl: false
        });

        this.setTiles(this.dataService.getTileIndex());
        let t = this;
        this.map.on('dragend', function(event) {
            t.setDefault();
        })

        this.map.on('click', function(event) {
            if (t.editMode !== "mouse" && t.editMode !== "move") {
                t.setDefault();
                if (t.editMode === "new") {
                    t.newPoints.push(L.circle(event.latlng, t.setHoverObjStyle()).addTo(t.layers['new']));
                }
            }
        })
        this.map.on('mousemove', (event) => {
            if (t.editMode == "move") {
                if (t.acPopUp !== undefined) {
                    t.acPopUp.close();
                }
                t.movePoint(event.latlng);
            }
        })
        this.map.on('zoomend', () => {
            t.loadContext(t.map.getCenter());
        })
    }

    constructor(private mapService: MapService, private dataService: DataService) {
        this.mapService.zoomInEvent().subscribe(() => {
            this.map.zoomIn();
        })

        this.mapService.zoomOutEvent().subscribe(() => {
            this.map.zoomOut();
        })

        this.mapService.onNewItemAddEvent().subscribe(async (command) => {
            if (command === 'start') {
                this.editMode = 'new';
                if (this.layers['new'] !== undefined) {
                    this.map.removeLayer(this.layers['new']);
                }
                this.layers['new'] = L.layerGroup();
                this.layers['new'].addTo(this.map);
            } else {
                if (command === 'save' && this.newPoints.length > 0) {
                    let indx = (await this.dataService.createPoint([this.newPoints[0].getLatLng().lat, this.newPoints[0].getLatLng().lng], [])).gid;
                    let nextIndx = 0;
                    for (let i = 1; i < this.newPoints.length; i++) {
                        nextIndx = (await this.dataService.createPoint([this.newPoints[i].getLatLng().lat, this.newPoints[i].getLatLng().lng], [indx])).gid;
                        let conns = await this.dataService.getPoint(indx);
                        conns.conns.push(nextIndx);
                        await this.dataService.updatePoint(indx, undefined, conns.conns);
                        indx = JSON.parse(JSON.stringify(nextIndx));
                    }
                }

                if (this.layers['new'] !== undefined) {
                    this.map.removeLayer(this.layers['new']);
                }
                this.newPoints = [];
                this.editMode = "mouse";
                this.setDefault();
            }
        })

        this.mapService.changeBaseMapEvent().subscribe((id) => {
            this.setTiles(id);
        })

        this.dataService.layerChange().subscribe(() => {
            this.loadContext(this.map.getCenter());
        })

        this.mapService.visibilityUpdateEvent().subscribe(() => {
            this.loadContext(this.map.getCenter());
        })
    }

    async ngAfterViewInit() {
        this.initMap();
    }

    setTiles(id: number): void {
        let t = this;
        if (this.layers['tiles'] !== undefined) {
            this.map.removeLayer(this.layers['tiles']);
        }

        this.layers['tiles'] = L.tileLayer(this.tiles.tiles[id].layer, {
            maxZoom: this.tiles.max_zoom,
            minZoom: this.tiles.min_zoom,
            attribution: this.tiles.tiles[id].attribution
        })
        .addTo(this.map);

        this.dataService.setTileIndex(id);
    }

    setDefault() {
        this.acPoint = undefined;
        this.acLine = undefined;
        if (this.editMode !== 'new') {
            this.editMode = "mouse";
        }
        if (this.acPopUp !== undefined) {
            this.acPopUp.close();   
        }
        this.loadContext(this.map.getCenter());
    }

    createKey(gidA: number, gidB: number) {
        if (gidA < gidB) {
            return gidA.toString() + '_' + gidB.toString();
        } else if (gidA > gidB) {
            return gidB.toString() + '_' + gidA.toString();
        } else {
            return false;
        }
    }

    createDirectionTriangle(pointA: any, pointB: any, center: any, layer: string, key: string) {
        pointA = this.map.latLngToLayerPoint(pointA);
        pointB = this.map.latLngToLayerPoint(pointB);
        
        let length_a = new L.Point(pointB.x, pointB.y).distanceTo(new L.Point(pointA.x, pointB.y));
        let length_b = new L.Point(pointA.x, pointA.y).distanceTo(new L.Point(pointB.x, pointB.y));
        let angle =  Math.asin(length_a / length_b) * (180 / Math.PI);

        if ((pointA.x - pointB.x) > 0 && (pointA.y - pointB.y) > 0) {
            angle = 180 - angle;
        } else if ((pointA.x - pointB.x) < 0 && (pointA.y - pointB.y) > 0) {
            angle = angle + 180;
        } else if ((pointA.x - pointB.x) > 0 && (pointA.y - pointB.y) < 0) {
        } else {
            angle = 0 - angle;
        }
        
        let triangleSize = 0.000015;
        let vertA = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle - 120);
        let vertB = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle);
        let vertC = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle + 120);

        if (!vertA || !vertB || !vertC) {
            return;
        }

        let t = this;
        let triangle = L.polygon([vertA, vertB, vertC], this.setObjStyle(layer, key !== undefined));
        if (key !== '') {
            triangle.addTo(this.layers["lines"])
            .on('click', (event) => {
                t.onLineClick(key);
                L.DomEvent.stop(event);
            })
        } else {
            triangle.addTo(this.layers["background"]);
        }
        triangle.bringToBack();

        return triangle;
    }

    rotatePoint(center:any, point:any, angle:any) {
        const centerPoint = this.map.latLngToLayerPoint(center);
        let edgePoint = this.map.latLngToLayerPoint(point);
        angle = angle * (Math.PI / 180);

        edgePoint = new L.Point(edgePoint.x - centerPoint.x, edgePoint.y - centerPoint.y);
        edgePoint = new L.Point(Math.cos(angle) * edgePoint.x - Math.sin(angle) * edgePoint.y, Math.sin(angle) * edgePoint.x + Math.cos(angle) * edgePoint.y);
        edgePoint = new L.Point(edgePoint.x + centerPoint.x, edgePoint.y + centerPoint.y);

        if (Number.isNaN(edgePoint.x) || Number.isNaN(edgePoint.y)) {
            return false;
        } else {
            return this.map.layerPointToLatLng(edgePoint);
        }
    }

    setObjStyle(layer: string, editable: boolean) {
        let objColor = "";
        let objOpacity = 0;
        let radius = 1;
        let interactive = true;

        if (layer === "rail") {
            objColor = "var(--rail)";
        } else if (layer === 'road') {
            objColor = "var(--road)";
        } else if (layer === 'tram') {
            objColor = "var(--tram)";
        }

        if (editable) {
            objOpacity = 1;
        } else {
            objOpacity = 0.4;
            radius = 0;
            interactive = false;
        }

        return {
            radius: radius,
            fillColor: objColor,
            color: objColor,
            opacity: objOpacity,
            weight: 4,
            fillOpacity: 1,
            interactive: interactive
        }
    }

    setHoverObjStyle() {
        return {
            radius: 1,
            fillColor: "var(--warning)",
            color: "var(--warning)",
            opacity: 1,
            weight: 4,
            fillOpacity: 1
        }
    }

    setPopUpStyle() {
        return {
            closeButton: false,
            className: "custom-popup"
        }
    }

    async loadContext(latLng: L.LatLng) {
        if (this.layers['background'] !== undefined) {
            this.map.removeLayer(this.layers['background']);
        }
        this.layers['background'] = L.layerGroup();
        this.layers['background'].addTo(this.map);

        if (this.layers['lines'] !== undefined) {
            this.map.removeLayer(this.layers['lines']);
        }
        this.layers['lines'] = L.layerGroup();
        this.layers['lines'].addTo(this.map);

        if (this.layers['points'] !== undefined) {
            this.map.removeLayer(this.layers['points']);
        }
        this.layers['points'] = L.layerGroup();
        this.layers['points'].addTo(this.map);

        this.curObjects = {};
        this.curConns = {};

        // Editable layer
        let response = await this.dataService.getPointsInRad([latLng.lat, latLng.lng], this.dataService.getCurLayer());
        for (let i = 0; i < response.length; i++) {
            this.curObjects[response[i].gid] = null;
        }
        for (let i = 0; i < response.length; i++) {
            let conns = [];
            for (let j = 0; j < response[i].conns.length; j++) {
                if (this.curObjects[response[i].conns[j]] === undefined) {
                    continue;
                }

                let key = this.createKey(response[i].gid, response[i].conns[j]);

                if (!key) {
                    continue;
                }

                // new connection, can be one way in result
                if (this.curConns[key] === undefined) {
                    this.curConns[key] = {'key': key, 't': 0, 'a': response[i].gid, 'b': response[i].conns[j], 'line': undefined};
                // there is already reverse connection, cur connection will be two way in result
                } else {
                    this.curConns[key].t = 1;
                }

                conns.push(key);
            }
            this.curObjects[response[i].gid] = {"gid": response[i].gid, "conns": conns, "point": undefined};
            this.createPoint(response[i].geom, response[i].gid, this.dataService.getCurLayer(), true);
        }

        let keys = Object.keys(this.curConns);
        for (let i = 0; i < keys.length; i++) {
            this.createLine(keys[i], this.dataService.getCurLayer(), false);
        }

        // Non editable layers
        let backgroundLayers: any = this.mapService.getBackgroundLayersState();
        keys = Object.keys(backgroundLayers);

        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === this.dataService.getCurLayer() || !backgroundLayers[keys[i]]) {
                continue;
            }
            let response = await this.dataService.getPointsInRad([latLng.lat, latLng.lng], keys[i]);
            let conns: any = {};
            let geoms: any = {};
            for (let j = 0; j < response.length; j++) {
                for (let k = 0; k < response[j].conns.length; k++) {
                    if (conns[response[j].gid.toString() + '_' + response[j].conns[k].toString()] === undefined &&
                        conns[response[j].conns[k].toString() + '_' + response[j].gid.toString()] === undefined) {
                        conns[response[j].gid.toString() + '_' + response[j].conns[k].toString()] = 0;
                    } else {
                        conns[response[j].conns[k].toString() + '_' + response[j].gid.toString()] = 1;
                    }
                }
                geoms[response[j].gid] = response[j].geom;
                this.createPoint(response[j].geom, 0, keys[i], false);
            }
            let innerKeys = Object.keys(conns);
            for (let j = 0; j < innerKeys.length; j++) {
                let pointA = geoms[innerKeys[j].split('_')[0]];
                let pointB = geoms[innerKeys[j].split('_')[1]];
                if (pointA === undefined || pointB === undefined) {
                    continue;
                }
                this.createLine('', keys[i], conns[innerKeys[j]] === 0, pointA, pointB);
            }
        }
    }

    createPoint(latLng: L.LatLng, gid: number, layer: string, editable: boolean) {
        let t = this;
        let point = L.circle(latLng, this.setObjStyle(layer, editable));
        if (editable) {
            point.on('click', (event) => {
                t.onPointClick(gid);
                L.DomEvent.stop(event);
            })
            .on('mousedown', (event) => {
                if (this.acPoint !== undefined && t.editMode === 'point') {
                    t.editMode = "move";
                }
                L.DomEvent.stop(event);
            })
            .on('mouseup', (event) => {
                if (this.acPoint !== undefined && t.editMode === 'move') {
                    t.editMode = "point";
                }
                L.DomEvent.stop(event);
            })
            .addTo(this.layers['points']);
            this.curObjects[gid].point = point;
        } else {
            point.addTo(this.layers['background']);
        }
    }

    createLine(key: string, layer: string, triangle: boolean, p_A?: any, p_B?: any) {
        let line, pointA, pointB;
        if (key !== '') {
            line = this.curConns[key];
            pointA = this.curObjects[line.a].point;
            if (pointA !== undefined) {
                pointA = pointA.getLatLng();
            }
            pointB = this.curObjects[line.b].point;
            if (pointB !== undefined) {
                pointB = pointB.getLatLng();
            }
        } else {
            pointA = p_A;
            pointB = p_B;
        }

        if (pointA === undefined || pointB === undefined) {
            return;
        }

        let t = this;
        let newLine = L.polyline([pointA, pointB], this.setObjStyle(layer, key !== ''));

        if (key !== '') {
            newLine.on('click', (event) => {
                t.onLineClick(key);
                L.DomEvent.stop(event);
            })
            .addTo(this.layers['lines'])
            line.line = newLine;
        } else {
            newLine.addTo(this.layers['background']);
        }

        if (key !== '' && line.t === 0) {
            line.triangle = this.createDirectionTriangle(pointA, pointB, newLine.getCenter(), layer, key);
        } else if (triangle) {
            this.createDirectionTriangle(pointA, pointB, newLine.getCenter(), layer, key);
        }
        newLine.bringToBack();

        return;
    }

    async onPointClick(gid: number) {
        if (this.acPoint === undefined && this.editMode === 'mouse') {
            this.acPoint = this.curObjects[gid];
            this.acPoint.point.setStyle(this.setHoverObjStyle());
            this.editMode = "point";
            this.onOnePointAction();
        } else if (this.acPoint !== undefined && this.editMode === 'point') {
            if (this.acPoint.gid !== gid) {
                if (this.curConns[this.acPoint.gid.toString() + '_' + gid.toString()] === undefined &&
                    this.curConns[gid.toString() + '_' + this.acPoint.gid.toString()] === undefined) {
                        this.onTwoPointAction(gid);
                    } else {
                        this.setDefault();
                    }
                return;
            }
            if (this.acPoint.point.getLatLng() !== undefined) {
                await this.dataService.updatePoint(this.acPoint.gid, this.dumpGeom(this.acPoint.point.getLatLng()),
                        this.dumpConns(this.acPoint.gid, this.acPoint.conns));
            }
            this.onOnePointAction();
        } else {
            this.setDefault();
        }
    }

    onOnePointAction() {
        let t = this;
        if (this.acPoint !== undefined && this.editMode === 'point') {
            let btn = document.createElement("button");
            btn.innerHTML = '<img src="assets/icons/trash.svg" class="mapBtnIn"/>';
            btn.className = "mapBtn";
            btn.onclick = function() {
                t.deletePoint();
            }
            this.acPopUp = L.popup(this.setPopUpStyle())
            .setContent(btn)
            .setLatLng(this.acPoint.point.getLatLng())
            .openOn(t.map);
        }
    }

    onTwoPointAction(secondGid: number) {
        this.editMode = 'twoPoint';
        this.curObjects[secondGid].point.setStyle(this.setHoverObjStyle());
        
        let t = this;
        let btn = document.createElement("button");
        btn.innerHTML = '<img src="assets/icons/joinPoints.svg" class="mapBtnIn"/>';
        btn.className = "mapBtn";
        btn.onclick = function() {
            t.joinPoints(secondGid);
        }
        let center = {"lat": (this.acPoint.point.getLatLng().lat + this.curObjects[secondGid].point.getLatLng().lat) / 2,
                      "lng": (this.acPoint.point.getLatLng().lng + this.curObjects[secondGid].point.getLatLng().lng) / 2 }
        this.acPopUp = L.popup(this.setPopUpStyle())
        .setContent(btn)
        .setLatLng(center)
        .openOn(t.map);
    }

    async deletePoint() {
        let conns = this.acPoint.conns;
        for (let i = 0; i < conns.length; i++) {
            if (conns[i].split('_')[0] !== this.acPoint.gid) {
                let key = conns[i].split('_')[0];
                if (this.curObjects[key].conns.indexOf(conns[i]) !== -1) {
                    this.curObjects[key].conns.splice(this.curObjects[key].conns.indexOf(conns[i]), 1);
                    await this.dataService.updatePoint(this.curObjects[key].gid, undefined, this.dumpConns(this.curObjects[key].gid, this.curObjects[key].conns));
                }
            } else {
                let key = conns[i].split('_')[1];
                if (this.curObjects[key].conns.indexOf(conns[i]) !== -1) {
                    this.curObjects[key].conns.splice(this.curObjects[key].conns.indexOf(conns[i]), 1);
                    await this.dataService.updatePoint(this.curObjects[key].gid, undefined, this.dumpConns(this.curObjects[key].gid, this.curObjects[key].conns));
                }
            }
        }

        await this.dataService.deletePoint(this.acPoint.gid);
        this.acPopUp.close();
        this.setDefault();
    }

    async joinPoints(secondGid: number) {
        let newConns = this.acPoint.conns;
        let newKey = this.acPoint.gid.toString() + '_' + this.curObjects[secondGid].gid.toString();

        newConns.push(newKey);
        await this.dataService.updatePoint(this.acPoint.gid, undefined, this.dumpConns(this.acPoint.gid, newConns));

        newConns = this.curObjects[secondGid].conns;
        newConns.push(newKey);
        await this.dataService.updatePoint(this.curObjects[secondGid].gid, undefined, this.dumpConns(this.curObjects[secondGid].gid, newConns));

        this.acPopUp.close();
        this.setDefault();
    }

    movePoint(latLng: any) {
        this.map.dragging.disable();
        this.acPoint.point.setLatLng(latLng);
        this.moveLinesToPoint(latLng);
        this.map.dragging.enable();
    }

    moveLinesToPoint(newLatLng: any) {
        let conns = Object.keys(this.curConns).filter(key => key.endsWith('_' + this.acPoint.gid.toString()));
        for (let i = 0; i < conns.length; i++) {
            let line = this.curConns[conns[i]];
            let oldLatLngs = line.line.getLatLngs();

            if (line.t === 0 && line.triangle !== undefined) {
                this.layers['lines'].removeLayer(line.triangle);
            }

            if (line.a === this.acPoint.gid) {
                line.line.setLatLngs([newLatLng, oldLatLngs[1]]);
                if (line.t === 0) {
                    line.triangle = this.createDirectionTriangle(newLatLng, oldLatLngs[1], line.line.getCenter(),
                        this.dataService.getCurLayer(), line.key);
                }
            } else {
                line.line.setLatLngs([oldLatLngs[0], newLatLng]);
                if (line.t === 0) {
                    line.triangle = this.createDirectionTriangle(oldLatLngs[0], newLatLng, line.line.getCenter(),
                        this.dataService.getCurLayer(), line.key);
                }
            }
        }

        conns = Object.keys(this.curConns).filter(key => key.startsWith(this.acPoint.gid.toString() + '_'));
        for (let i = 0; i < conns.length; i++) {
            let line = this.curConns[conns[i]];
            let oldLatLngs = line.line.getLatLngs();

            if (line.t === 0 && line.triangle !== undefined) {
                this.layers['lines'].removeLayer(line.triangle);
            }
   
            if (line.a === this.acPoint.gid) {
                line.line.setLatLngs([newLatLng, oldLatLngs[1]]);
                if (line.t === 0) {
                    line.triangle = this.createDirectionTriangle(newLatLng, oldLatLngs[1], line.line.getCenter(),
                        this.dataService.getCurLayer(), line.key);
                }
            } else {
                line.line.setLatLngs([oldLatLngs[0], newLatLng]);
                if (line.t === 0) {
                    line.triangle = this.createDirectionTriangle(oldLatLngs[0], newLatLng, line.line.getCenter(),
                        this.dataService.getCurLayer(), line.key);
                }
            }
        }
        
    }

    onLineClick(key: string) {
        if (this.acLine === undefined && this.editMode === 'mouse') {
            this.acLine = this.curConns[key];
            this.acLine.line.setStyle(this.setHoverObjStyle());
            if (this.acLine.triangle !== undefined) {
                this.acLine.triangle.setStyle(this.setHoverObjStyle());
            }
            this.editMode = "line";
            this.onLineAction();
        } else {
            this.setDefault();
        }
    }

    onLineAction() {
        let t = this;
        if (this.acLine !== undefined && this.editMode === 'line') {
            let div = document.createElement("div");
            let btnConn = document.createElement("button");
            btnConn.innerHTML = '<img src="assets/icons/trash.svg" class="mapBtnIn"/>';
            btnConn.className = "mapBtn";
            btnConn.onclick = function() {
                t.deleteLine();
            }
            div.appendChild(btnConn);

            let btnAdd = document.createElement("button");
            btnAdd.innerHTML = '<img src="assets/icons/newPoint.svg" class="mapBtnIn"/>';
            btnAdd.className = "mapBtn";
            btnAdd.onclick = function() {
                t.addMidPoint();
            }
            div.appendChild(btnAdd);

            let btnTwoDir = document.createElement("button");
            btnTwoDir.innerHTML = '<img src="assets/icons/both.svg" class="mapBtnIn"/>';
            btnTwoDir.className = "mapBtn";
            btnTwoDir.onclick = function() {
                t.makeLineBothWay();
            }
            div.appendChild(btnTwoDir);

            let btnOneDir = document.createElement("button");
            btnOneDir.innerHTML = '<img src="assets/icons/turn.svg" class="mapBtnIn"/>';
            btnOneDir.className = "mapBtn";
            btnOneDir.onclick = function() {
                t.makeLineOneWay();
            }
            div.appendChild(btnOneDir);

            this.acPopUp = L.popup(this.setPopUpStyle())
            .setContent(div)
            .setLatLng(this.acLine.line.getCenter())
            .openOn(t.map);
        }
    }

    async deleteLine() {
        let pointA = this.curObjects[this.acLine.a];
        let pointB = this.curObjects[this.acLine.b];

        if (pointA.conns.indexOf(this.acLine.key) !== -1) {
            pointA.conns.splice(pointA.conns.indexOf(this.acLine.key), 1);   
        }
        await this.dataService.updatePoint(pointA.gid, undefined, this.dumpConns(pointA.gid, pointA.conns));

        if (pointB.conns.indexOf(this.acLine.key) !== -1) {
            pointB.conns.splice(pointB.conns.indexOf(this.acLine.key), 1);   
        }
        await this.dataService.updatePoint(pointB.gid, undefined, this.dumpConns(pointB.gid, pointB.conns));

        this.setDefault();
    }
    
    async addMidPoint() {
        let newConns: number[] = [];

        newConns.push(this.acLine.b);
        if (this.acLine.t === 1) {
            newConns.push(this.acLine.a);
        }
        let newPointGid = await this.dataService.createPoint([this.acLine.line.getCenter().lat, this.acLine.line.getCenter().lng], newConns);

        newConns = this.dumpConns(this.acLine.a, this.curObjects[this.acLine.a].conns);
        newConns.splice(newConns.indexOf(this.acLine.b), 1);
        newConns.push(newPointGid.gid);
        await this.dataService.updatePoint(this.acLine.a, undefined, newConns);

        if (this.acLine.t === 1) {
            newConns = this.dumpConns(this.acLine.b, this.curObjects[this.acLine.b].conns);
            newConns.splice(newConns.indexOf(this.acLine.a), 1);
            newConns.push(newPointGid.gid);
            await this.dataService.updatePoint(this.acLine.b, undefined, newConns);
        }

        this.setDefault();
    }

    async makeLineBothWay() {
        await this.dataService.setLineDirection(this.acLine.a, this.acLine.b, 0);
        this.setDefault();
    }

    async makeLineOneWay() {
        await this.dataService.setLineDirection(this.acLine.b, this.acLine.a, 1);
        this.setDefault();
    }

    dumpGeom(latLng: any) {
        return [latLng.lat, latLng.lng];
    }

    dumpConns(gid: number, conns: any) {
        let result: number[] = [];
        for (let i = 0; i < conns.length; i++) {
            if (parseInt(conns[i].split('_')[0]) === gid) {
                result.push(parseInt(conns[i].split('_')[1]));
            } else {
                result.push(parseInt(conns[i].split('_')[0]));
            }
        }
        
        return result;
    }
}
