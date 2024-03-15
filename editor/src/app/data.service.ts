/*
 * API handling service
 */

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, retry } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})

export class DataService {
    private curTitleIndex = 0;
    private layerChangeObj = new Subject<any>();
    private curLayer = '';

    constructor(private httpClient: HttpClient) {}

    private whoToAsk = environment.apiUrl;
    private headers = new HttpHeaders();

    // Inner functions
    setTileIndex(id: number) {
        this.curTitleIndex = id;
    }

    setCurLayer(layer: string) {
        if (layer !== 'rail' && layer != 'road' && layer != 'tram') {
            return false;
        } else {
            this.curLayer = layer;
            return true;
        }
    }

    getTileIndex(): number {
        return this.curTitleIndex;
    }

    openLayer(layer: string) {
        this.setCurLayer(layer);
        this.layerChangeObj.next(1);
    }

    // Query functions
    queryIsDbAlive() {
        return this.httpClient.get(this.whoToAsk + "/mapStats", {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryLogIn(name: string, password: string) {
        let logInHeader = new HttpHeaders();
        logInHeader = logInHeader.set('Authorization', 'Basic ' + btoa(name + ':' + password));
        return this.httpClient.get(this.whoToAsk + "/login?type=editor", {headers: logInHeader})
        .pipe(
            retry(1)
          );
    }

    queryGetPoint(gid: number) {
        return this.httpClient.get(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryPostPutPoint(gid: number, reqType:string, geom?: number[], conns?: number[]) {
        if (reqType === 'post') {
            return this.httpClient.post(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() +
                "&geom=" + JSON.stringify(geom) + "&conns=" + JSON.stringify(conns), {}, {headers: this.headers})
                .pipe(
                    retry(3)
                );
        } else {
            let params = "";
            if (geom !== undefined) {
                params += "&geom=" + JSON.stringify(geom);
            }
            if (conns !== undefined) {
                params += "&conns=" + JSON.stringify(conns);
            }

            return this.httpClient.put(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid + params, {}, {headers: this.headers})
            .pipe(
                retry(3)
            );
        }
    }

    queryPostPoints(hubs: any) {
        return this.httpClient.post(this.whoToAsk + "/createPoints?layer=" + this.getCurLayer() +
                "&hubs=" + JSON.stringify(hubs), {}, {headers: this.headers})
                .pipe(
                    retry(3)
                );
    }

    queryDeletePoint(gid:number) {
        return this.httpClient.delete(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryDeleteLayer() {
        return this.httpClient.delete(this.whoToAsk + "/layer?layer=" + this.getCurLayer(), {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsInRad(latLng: [number, number], layer: string) {
        return this.httpClient.get(this.whoToAsk + "/pointsInRad?layer=" + layer + "&geom=" + JSON.stringify(latLng), {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsByGid(gid: number) {
        return this.httpClient.get(this.whoToAsk + "/pointsByGid?layer=" + this.getCurLayer() + "&gid=" + gid, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    querySetLineDirection(gidA: number, gidB: number, mode: number) {
        return this.httpClient.put(this.whoToAsk + "/changeDirection?layer=" + this.getCurLayer() + "&gidA=" + gidA
            + "&gidB=" + gidB + "&mode=" + mode, {}, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryDeleteSection(gidA:number, gidB:number) {
        return this.httpClient.delete(this.whoToAsk + "/section?layer=" + this.getCurLayer() + "&gidA=" + gidA + "&gidB=" + gidB, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetStopsInRad(latLng: [number, number]) {
        return this.httpClient.get(this.whoToAsk + "/stopsInRad?geom=" + JSON.stringify(latLng), {headers: this.headers})
        .pipe(
            retry(3)
          );
    }


    queryGetMidPointsInRad(latLng: [number, number]) {
        return this.httpClient.get(this.whoToAsk + "/midPointsInRad?geom=" + JSON.stringify(latLng), {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    // Callable functions
    // Get JWT from API
    getToken(name: string, password: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryLogIn(name, password).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            }, error => {
                resolve(false);
            });
        });
    }

    // Is DB connected to frontend?
    connectToDB(name: string, password: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            let token = await this.getToken(name, password);
            if (token) {
                this.headers = this.headers.set('Authorization', token);
                this.openLayer('rail');
                resolve(token);
            } else {
                resolve(token);
            }
        });
    }

    // Get map tiles layer
    getCurLayer(): string {
        return this.curLayer;
    }

    // Change map tiles layer
    layerChange(): Observable<any> {
        return this.layerChangeObj.asObservable();
    }

    // Get DB stats
    getStats(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryIsDbAlive().subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Get 1 point by GID
    getPoint(gid: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetPoint(gid).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Create point, return new GID
    createPoint(geom: [number, number], conns: number[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostPutPoint(0, 'post', geom, conns).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Create more points, used in import user case
    createPoints(hubs: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostPoints(hubs).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Update 1 point props
    updatePoint(gid: number, geom?: number[], conns?: number[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostPutPoint(gid, 'put', geom, conns).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Delete 1 point
    deletePoint(gid: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryDeletePoint(gid).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Delete whole point layer(trams, trains, roads), used in import user case
    deleteAcLayer(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryDeleteLayer().subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Get points and its connections around some point
    getPointsInRad(latLng: [number, number], layer: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetPointsInRad(latLng, layer).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Get points by GID, used in export user case
    getPointsByGid(gid: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetPointsByGid(gid).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Set line direction
    setLineDirection(gidA: number, gidB: number, mode: number) {
        return new Promise((resolve, reject) => {
            this.querySetLineDirection(gidA, gidB, mode).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Delete whole section form crossroad to crossroad
    deleteSection(gidA: number, gidB: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryDeleteSection(gidA, gidB).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Get stops and its names around some point
    getStopsInRad(latLng: [number, number]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetStopsInRad(latLng).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Get midpoints around some point
    getMidPointsInRad(latLng: [number, number]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetMidPointsInRad(latLng).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }
}