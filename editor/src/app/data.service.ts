import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, retry } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})

export class DataService {
    private curTitleIndex = 0;
    private layerChangeObj = new Subject<any>();
    private DBConnected: Boolean | undefined = false;
    private curLayer = '';
    private DBGuard: NodeJS.Timer | undefined;

    constructor(private httpClient: HttpClient) {
        this.isDBConnected(0);
    }

    private whoToAsk = environment.apiUrl;

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
        return this.httpClient.get(this.whoToAsk + "/mapStats")
        .pipe(
            retry(3)
          );
    }

    queryGetPoint(gid: number) {
        return this.httpClient.get(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    queryPostPutPoint(gid: number, reqType:string, geom?: number[], conns?: number[]) {
        if (reqType === 'post') {
            return this.httpClient.post(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() +
                "&geom=" + JSON.stringify(geom) + "&conns=" + JSON.stringify(conns), {})
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

            return this.httpClient.put(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid + params, {})
            .pipe(
                retry(3)
            );
        }
    }

    queryPostPoints(hubs: any) {
        return this.httpClient.post(this.whoToAsk + "/createPoints?layer=" + this.getCurLayer() +
                "&hubs=" + JSON.stringify(hubs), {})
                .pipe(
                    retry(3)
                );
    }

    queryDeletePoint(gid:number) {
        return this.httpClient.delete(this.whoToAsk + "/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    queryDeleteLayer() {
        return this.httpClient.delete(this.whoToAsk + "/layer?layer=" + this.getCurLayer(), {})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsInRad(latLng: [number, number], layer: string) {
        return this.httpClient.get(this.whoToAsk + "/pointsInRad?layer=" + layer + "&geom=" + JSON.stringify(latLng), {})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsByGid(gid: number) {
        return this.httpClient.get(this.whoToAsk + "/pointsByGid?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    querySetLineDirection(gidA: number, gidB: number, mode: number) {
        return this.httpClient.put(this.whoToAsk + "/changeDirection?layer=" + this.getCurLayer() + "&gidA=" + gidA
            + "&gidB=" + gidB + "&mode=" + mode, {})
        .pipe(
            retry(3)
          );
    }

    queryDeleteSection(gidA:number, gidB:number) {
        return this.httpClient.delete(this.whoToAsk + "/section?layer=" + this.getCurLayer() + "&gidA=" + gidA + "&gidB=" + gidB, {})
        .pipe(
            retry(3)
          );
    }

    // Callable functions
    // Is DB connected to frontend?
    isDBConnected(attempt: number): void {
        if (attempt > 5) {
            console.log("Can not connect to DB. Please try to restart client.")
            return;
        }
        this.queryIsDbAlive().subscribe(response => {
            if (response) {
                this.DBConnected = true;
                this.openLayer('rail');
                attempt = 0;
            } else {
                let t = this;
                setTimeout(function() {
                    t.isDBConnected(attempt + 1);
                }, 2000);
            }
        });
    }

    // Get map tiles layer
    getCurLayer(): string {
        return this.curLayer;
    }

    // Change map tiles layer
    layerChange(): Observable<any>{
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
}