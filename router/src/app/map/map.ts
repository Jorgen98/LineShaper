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
    private layers: any = {
        'background': undefined,
        'stops': undefined
    }

    private acPopUp: any = undefined;
    private midPoints: any = [];
    private selMidPoint: any = undefined;
    private selMidPointIndx: any = 0;
    private move = false;

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
            t.setDefault();
        })

        this.map.on('mousemove', (event) => {
            if (t.selMidPoint !== undefined && t.move) {
                if (t.acPopUp !== undefined) {
                    t.acPopUp.close();
                }
                t.moveMidPoint(event.latlng);
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

        this.mapService.changeBaseMapEvent().subscribe((id) => {
            this.setTiles(id);
        })

        this.mapService.visibilityUpdateEvent().subscribe(() => {
            this.loadContext(this.map.getCenter());
        })

        this.mapService.putRouteOnMapEvent().subscribe((stops) => {
            this.createRoute(stops);
        })
    }

    async ngAfterViewInit() {
        this.initMap();
        this.setDefault();

        // Routing test
        /*let route = await this.dataService.getWholeLine(2, 'b');

        if (!route) {
            return;
        }

        this.createRoute(route);*/
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

    async setDefault() {
        await this.loadContext(this.map.getCenter());
        if (this.acPopUp !== undefined) {
            this.acPopUp.close();
        }
    }

    createDirectionTriangle(pointA: any, pointB: any, center: any, layer: string, props: any = undefined) {
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
        let triangle = L.polygon([vertA, vertB, vertC], this.setObjStyle(layer));
        if (layer === 'midPoint') {
            triangle.on('click', async (event) => {
                if (this.selMidPoint !== undefined) {
                    await this.setDefault();
                }
                t.onLineClick(props);
                L.DomEvent.stop(event);
            })
            .addTo(this.layers['midPoint']);
        } else {
            triangle.addTo(this.layers['background']);
            triangle.bringToBack();
        }

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

    setObjStyle(layer: string, name?: string) {
        let objColor = "";
        let objOpacity = 0;
        let radius = 1;
        let interactive = true;

        if (layer === "stop") {
            objColor = "var(--black)";
        } else if (layer === "rail") {
            objColor = "var(--rail)";
        } else if (layer === 'road') {
            objColor = "var(--road)";
        } else if (layer === 'tram') {
            objColor = "var(--tram)";
        } else if (layer === 'route') {
            objColor = "var(--route)";
        } else if (layer === 'midPoint') {
            objColor = "var(--midPoint)";
        } else if (layer === 'hoover') {
            objColor = "var(--warning)";
        }

        if (layer === "stop" || layer === 'midPoint' || layer === "hoover") {
            objOpacity = 1;
        } else if (layer === 'route') {
            objOpacity = 1;
            interactive = false;
            radius = 2;
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

        if (this.layers['stops'] !== undefined) {
            this.map.removeLayer(this.layers['stops']);
        }
        this.layers['stops'] = L.layerGroup();
        this.layers['stops'].addTo(this.map);

        if (this.layers['midPoint'] !== undefined) {
            this.map.removeLayer(this.layers['midPoint']);
        }
        this.layers['midPoint'] = L.layerGroup();
        this.layers['midPoint'].addTo(this.map);

        //Midpoints
        if (this.mapService.getBackgroundLayersState()['midPoint']) {
            this.createMidpoint(await this.dataService.getMidPointsInRad([latLng.lat, latLng.lng]));
        }

        //Stops
        if (this.mapService.getBackgroundLayersState()['stops']) {
            this.createStops(await this.dataService.getStopsInRad([latLng.lat, latLng.lng]));
        }

        // Non editable layers
        let backgroundLayers: any = this.mapService.getBackgroundLayersState();
        let keys = Object.keys(backgroundLayers);

        for (let i = 0; i < keys.length; i++) {
            if (!backgroundLayers[keys[i]] || keys[i] === 'midPoint') {
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
                this.createPoint(response[j].geom, keys[i]);
            }
            let innerKeys = Object.keys(conns);
            for (let j = 0; j < innerKeys.length; j++) {
                let pointA = geoms[innerKeys[j].split('_')[0]];
                let pointB = geoms[innerKeys[j].split('_')[1]];
                if (pointA === undefined || pointB === undefined) {
                    continue;
                }
                this.createLine(pointA, pointB, keys[i], conns[innerKeys[j]] === 0);
            }
        }
    }

    createPoint(latLng: L.LatLng, layer: string, props: any = {}) {
        let t = this;
        let point = L.circle(latLng, this.setObjStyle(layer));

        if (layer === 'stop') {
            point.addTo(this.layers['stops'])
                .on('click', (event) => {
                    t.mapService.onStopClick(props);
                    L.DomEvent.stop(event);
                })
                .bindTooltip(props.label);
        } else if (layer === 'midPoint') {
            point.addTo(this.layers['midPoint'])
                .on('click', (event) => {
                    t.onMidPointAction(t.midPoints[props.index], props.pointIndex);
                    L.DomEvent.stop(event);
                })
                .on('mousedown', (event) => {
                    if (this.selMidPoint !== undefined) {
                        t.move = true;
                    }
                    L.DomEvent.stop(event);
                })
                .on('mouseup', (event) => {
                    if (this.selMidPoint !== undefined) {
                        t.move = false;
                        t.saveMidPointChanges();
                    }
                    L.DomEvent.stop(event);
                })
        } else if (layer === 'route') {
            point.addTo(this.layers['route']);
        } else {
            point.addTo(this.layers['background']);
        }

        return point;
    }

    createLine(pointA: any, pointB: any, layer: string, triangle: boolean, props: any = {}) {
        if (pointA === undefined || pointB === undefined) {
            return;
        }

        let newLine = L.polyline([pointA, pointB], this.setObjStyle(layer));
        let t = this;

        if (layer === 'midPoint') {
            newLine.on('click', async (event) => {
                    if (this.selMidPoint !== undefined) {
                        await this.setDefault();
                    }
                    t.onLineClick(props);
                    L.DomEvent.stop(event);
                })
                .addTo(this.layers['midPoint'])
        } else if (layer === 'route') {
            newLine.addTo(this.layers['route']);
        } else {
            newLine.addTo(this.layers['background']);
        }

        let newTriangle;

        if (triangle) {
            newTriangle = this.createDirectionTriangle(pointA, pointB, newLine.getCenter(), layer, props);
        }

        if (layer !== 'midPoint' || this.move) {
            newLine.bringToBack();
        }

        return {'line': newLine, 'triangle': newTriangle};
    }

    createRoute(input: any) {
        if (this.layers['route'] !== undefined) {
            this.map.removeLayer(this.layers['route']);
        }
        this.layers['route'] = L.layerGroup();
        this.layers['route'].addTo(this.map);

        for (let i = 0; i < (input.route.length - 1); i++) {
            this.createLine(input.route[i], input.route[i + 1], 'route', true);
        }

        for (let i = 0; i < input.stops.length; i++) {
            this.createPoint(input.stops[i], 'route');
        }

        this.loadContext(this.map.getCenter());
    }

    createStops(input: any) {
        let stopsOnMap: {[id: string]: {geom: L.LatLng, label: string, keys: string []}} = {};
        for (const stop of input) {
            let key = stop.geom[0].toString() + stop.geom[1].toString();
            let label = stop.name;
            let codes = [];
            for (const sign of stop.subcodes) {
                label += ' ' + sign;
                codes.push(stop.code + '_' + sign);
            }

            if (stopsOnMap[key] !== undefined) {
                stopsOnMap[key].label += ', ' + label;
                stopsOnMap[key].keys = stopsOnMap[key].keys.concat(codes);
            } else {
                stopsOnMap[key] = {geom: stop.geom, label: label, keys: codes};
            }
        }

        for (const stop in stopsOnMap) {
            this.createPoint(stopsOnMap[stop].geom, 'stop', stopsOnMap[stop]);
        }
    }

    createMidpoint(input: any) {
        this.midPoints = [];
        this.selMidPoint = undefined;

        for (let i = 0; i < input.length; i++) {
            let lines = [];
            let triangles = [];
            for (let j = 0; j < (input[i].points.length - 1); j++) {
                let newObjs = this.createLine(input[i].points[j], input[i].points[j + 1], 'midPoint', true, {'index': i, 'lineIndex': j});
                lines.push(newObjs?.line);
                triangles.push(newObjs?.triangle);
            }

            this.midPoints.push({'id': input[i].id, 'lines': lines, 'triangles': triangles, 'points': []});
        }

        for (let i = 0; i < input.length; i++) {
            let points = [];
            for (let j = 1; j < (input[i].points.length - 1); j++) {
                points.push(this.createPoint(input[i].points[j], 'midPoint', {'index': i, 'pointIndex': j - 1}));
            }
            this.midPoints[i].points = points;
        }
    }

    onMidPointAction(midPointData: any, pointIndex: number, type = 'base') {
        midPointData.points[pointIndex].setStyle(this.setObjStyle('hoover'));
        this.selMidPoint = midPointData;
        this.selMidPointIndx = pointIndex;

        let t = this;
        let div = document.createElement("div");
        if (type === 'base') {
            let btn = document.createElement("button");
            btn.innerHTML = '<img src="assets/icons/trash.svg" class="mapBtnIn"/>';
            btn.className = "mapBtn";
            btn.onclick = function() {
                t.onMidPointAction(midPointData, pointIndex, 'delete');
            }
            div.appendChild(btn);
        } else if (type === 'delete') {
            if (midPointData.points.length > 1) {
                let btn = document.createElement("button");
                btn.innerHTML = '<p class="mapBtnTxt">Smazat tento bod</p>';
                btn.className = "mapBtnTxt";
                btn.onclick = async function() {
                    await t.deleteOneMidPoint(pointIndex);
                    t.setDefault();
                }
                div.appendChild(btn);
            }

            let btnWhole = document.createElement("button");
            btnWhole.innerHTML = '<p class="mapBtnTxt">Vymazat celou medzi sekci</p>';
            btnWhole.className = "mapBtnTxt";
            btnWhole.onclick = async function() {
                await t.deleteMidPoint();
                t.setDefault();
            }
            div.appendChild(btnWhole);
        }

        this.acPopUp = L.popup(this.setPopUpStyle())
        .setContent(div)
        .setLatLng(midPointData.points[pointIndex].getLatLng())
        .openOn(t.map);
    }

    onLineClick(props: any, type = 'base') {
        this.selMidPoint = this.midPoints[props.index];
        this.selMidPoint.lines[props.lineIndex].setStyle(this.setObjStyle('hoover'));
        this.selMidPoint.triangles[props.lineIndex].setStyle(this.setObjStyle('hoover'));
        
        let t = this;
        let div = document.createElement("div");
        if (type === 'base') {
            let btnAdd = document.createElement("button");
            btnAdd.innerHTML = '<img src="assets/icons/newPoint.svg" class="mapBtnIn"/>';
            btnAdd.className = "mapBtn";
            btnAdd.onclick = function() {
                t.addMidPoint(props.lineIndex);
            }
            div.appendChild(btnAdd);

            let btn = document.createElement("button");
            btn.innerHTML = '<img src="assets/icons/trash.svg" class="mapBtnIn"/>';
            btn.className = "mapBtn";
            btn.onclick = function() {
                t.onLineClick(props, 'delete');
            }
            div.appendChild(btn);
        } else if (type === 'delete') {
            let btn = document.createElement("button");
            btn.innerHTML = '<p class="mapBtnTxt">Vymazat celou medzi sekci</p>';
            btn.className = "mapBtnTxt";
            btn.onclick = async function() {
                await t.deleteMidPoint();
                t.setDefault();
            }
            div.appendChild(btn);
        }

        let center = {"lat": (this.selMidPoint.lines[props.lineIndex].getLatLngs()[0].lat + this.selMidPoint.lines[props.lineIndex].getLatLngs()[1].lat) / 2,
                      "lng": (this.selMidPoint.lines[props.lineIndex].getLatLngs()[0].lng + this.selMidPoint.lines[props.lineIndex].getLatLngs()[1].lng) / 2 }
        this.acPopUp = L.popup(this.setPopUpStyle())
        .setContent(div)
        .setLatLng(center)
        .openOn(t.map);
    }

    moveMidPoint(latLng: any) {
        this.map.dragging.disable();
        this.selMidPoint.points[this.selMidPointIndx].setLatLng(latLng);
        this.moveMidPointLines(latLng);
        this.map.dragging.enable();
    }

    moveMidPointLines(latLng: any) {
        let lineA = this.selMidPoint.lines[this.selMidPointIndx];
        let lineB = this.selMidPoint.lines[this.selMidPointIndx + 1];

        let triangleA = this.selMidPoint.triangles[this.selMidPointIndx];
        let triangleB = this.selMidPoint.triangles[this.selMidPointIndx + 1];

        let newObjs;

        newObjs = this.createLine(lineA.getLatLngs()[0], latLng, 'midPoint', true);
        this.selMidPoint.lines[this.selMidPointIndx] = newObjs?.line;
        this.selMidPoint.triangles[this.selMidPointIndx] = newObjs?.triangle;
        this.map.removeLayer(lineA);
        this.map.removeLayer(triangleA);

        newObjs = this.createLine(latLng, lineB.getLatLngs()[1], 'midPoint', true);
        this.selMidPoint.lines[this.selMidPointIndx + 1] = newObjs?.line;
        this.selMidPoint.triangles[this.selMidPointIndx + 1] = newObjs?.triangle;
        this.map.removeLayer(lineB);
        this.map.removeLayer(triangleB);
    }

    async addMidPoint(index: number) {
        let midPoints = [];

        for (let i = 0; i < index; i++) {
            midPoints.push([this.selMidPoint.points[i].getLatLng().lat, this.selMidPoint.points[i].getLatLng().lng]);
        }

        let center = [(this.selMidPoint.lines[index].getLatLngs()[0].lat + this.selMidPoint.lines[index].getLatLngs()[1].lat) / 2,
                      (this.selMidPoint.lines[index].getLatLngs()[0].lng + this.selMidPoint.lines[index].getLatLngs()[1].lng) / 2 ];
        midPoints.push(center);

        for (let i = index; i < this.selMidPoint.points.length; i++) {
            midPoints.push([this.selMidPoint.points[i].getLatLng().lat, this.selMidPoint.points[i].getLatLng().lng]);
        }

        await this.dataService.updateMidpoint(this.selMidPoint.id, midPoints);
        this.setDefault();
    }

    async deleteOneMidPoint(index: number) {
        let midPoints = [];

        for (let i = 0; i < this.selMidPoint.points.length; i++) {
            if (i === index) {
                continue;
            }
            midPoints.push([this.selMidPoint.points[i].getLatLng().lat, this.selMidPoint.points[i].getLatLng().lng]);
        }

        await this.dataService.updateMidpoint(this.selMidPoint.id, midPoints);
        this.setDefault();
    }

    async saveMidPointChanges() {
        let midPoints = [];

        for (let i = 0; i < this.selMidPoint.points.length; i++) {
            midPoints.push([this.selMidPoint.points[i].getLatLng().lat, this.selMidPoint.points[i].getLatLng().lng]);
        }

        await this.dataService.updateMidpoint(this.selMidPoint.id, midPoints);
        this.setDefault();
    }

    async deleteMidPoint() {
        await this.dataService.deleteMidpoint(this.selMidPoint.id);
    }
}
