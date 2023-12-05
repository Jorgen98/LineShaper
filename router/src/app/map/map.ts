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
    private selPoint: any = [];

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
    }

    async ngAfterViewInit() {
        this.initMap();
        this.setDefault();
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
        this.loadContext(this.map.getCenter());
        if (this.acPopUp !== undefined) {
            this.acPopUp.close();
        }
    }

    createDirectionTriangle(pointA: any, pointB: any, center: any, layer: string) {
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
        triangle.addTo(this.layers["background"]);
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
            objColor = "var(--warning)";
        }

        if (layer === "stop" || layer === 'route') {
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

        if (this.layers['stops'] !== undefined) {
            this.map.removeLayer(this.layers['stops']);
        }
        this.layers['stops'] = L.layerGroup();
        this.layers['stops'].addTo(this.map);

        //Stops
        let response = await this.dataService.getStopsInRad([latLng.lat, latLng.lng]);
        for (let i = 0; i < response.length; i++) {
            this.createPoint(response[i].geom, 'stop', response[i]);
        }

        // Non editable layers
        let backgroundLayers: any = this.mapService.getBackgroundLayersState();
        let keys = Object.keys(backgroundLayers);

        for (let i = 0; i < keys.length; i++) {
            if (!backgroundLayers[keys[i]]) {
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
                    t.onOnePointAction(latLng, props);
                    L.DomEvent.stop(event);
                })
        } else {
            point.addTo(this.layers['background']);
        }
    }

    createLine(pointA: any, pointB: any, layer: string, triangle: boolean) {
        let line;

        if (pointA === undefined || pointB === undefined) {
            return;
        }

        let t = this;
        let newLine = L.polyline([pointA, pointB], this.setObjStyle(layer));
        newLine.addTo(this.layers['background']);

        if (triangle) {
            this.createDirectionTriangle(pointA, pointB, newLine.getCenter(), layer);
        }
        newLine.bringToBack();

        return;
    }

    onOnePointAction(geom: any, props: any) {
        let t = this;
        let div = document.createElement("div");
        div.className = "mapDiv";

        let btn = document.createElement("button");
        btn.innerHTML = '<p class="mapBtnTxt">' + props.name + '\n' + props.subcode + '</p>';
        btn.className = "mapBtn";
        btn.disabled = true;
        div.appendChild(btn);

        btn = document.createElement("button");
        btn.innerHTML = '<p class="mapBtnTxt">Odtud</p>';
        btn.className = "mapBtn";
        btn.onclick = function() {
            t.makeTwoPointRoute(0, props);
        }
        div.appendChild(btn);

        if (this.selPoint.length > 0) {
            btn = document.createElement("button");
            btn.innerHTML = '<p class="mapBtnTxt">Přes</p>';
            btn.className = "mapBtn";
            btn.onclick = function() {
                t.makeTwoPointRoute(2, props);
            }
            div.appendChild(btn);

            btn = document.createElement("button");
            btn.innerHTML = '<p class="mapBtnTxt">Sem</p>';
            btn.className = "mapBtn";
            btn.onclick = function() {
                t.makeTwoPointRoute(1, props);
            }
            div.appendChild(btn);
        }

        if (this.acPopUp !== undefined) {
            this.acPopUp.close();   
        }

        this.acPopUp = L.popup(this.setPopUpStyle())
        .setContent(div)
        .setLatLng(geom)
        .openOn(t.map);
    }


    async makeTwoPointRoute(mode: number, props: any) {
        if (mode === 0) {
            this.selPoint = [props.code + '_' + props.subcode];
        } else if (mode === 1) {
            this.selPoint.push(props.code + '_' + props.subcode);
            this.createRoute(await this.dataService.getRoute(this.selPoint, 'tram'));
            this.selPoint = [];
        } else if (mode === 2) {
            this.selPoint.push(props.code + '_' + props.subcode);
        }

        this.setDefault();
    }

    createRoute(points: any) {
        if (this.layers['route'] !== undefined) {
            this.map.removeLayer(this.layers['route']);
        }
        this.layers['route'] = L.layerGroup();
        this.layers['route'].addTo(this.map);

        let newLine = L.polyline(points, this.setObjStyle('route'));
        newLine.addTo(this.layers['route']);
    }
}
