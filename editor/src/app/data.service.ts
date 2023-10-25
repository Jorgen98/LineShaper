import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, retry } from 'rxjs';

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

    setTitleIndex(id: number) {
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

    getTitleIndex(): number {
        return this.curTitleIndex;
    }

    openLayer(layer: string) {
        this.setCurLayer(layer);
        this.layerChangeObj.next(1);
    }

    queryIsDbAlive() {
        return this.httpClient.get("http://172.25.182.2:8087/mapStats")
        .pipe(
            retry(3)
          );
    }

    queryGetPoint(gid: number) {
        return this.httpClient.get("http://172.25.182.2:8087/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    queryPostPutPoint(gid: number, reqType:string, geom?: number[], conns?: number[]) {
        if (reqType === 'post') {
            return this.httpClient.post("http://172.25.182.2:8087/mapPoint?layer=" + this.getCurLayer() +
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

            return this.httpClient.put("http://172.25.182.2:8087/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid + params, {})
            .pipe(
                retry(3)
            );
        }
    }

    queryPostPoints(hubs: any) {
        return this.httpClient.post("http://172.25.182.2:8087/createPoints?layer=" + this.getCurLayer() +
                "&hubs=" + JSON.stringify(hubs), {})
                .pipe(
                    retry(3)
                );
    }

    queryDeletePoint(gid:number) {
        return this.httpClient.delete("http://172.25.182.2:8087/mapPoint?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    queryDeleteLayer() {
        return this.httpClient.delete("http://172.25.182.2:8087/layer?layer=" + this.getCurLayer(), {})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsInRad(latLng: [number, number]) {
        return this.httpClient.get("http://172.25.182.2:8087/pointsInRad?layer=" + this.getCurLayer() + "&geom=" + JSON.stringify(latLng), {})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsByGid(gid: number) {
        return this.httpClient.get("http://172.25.182.2:8087/pointsByGid?layer=" + this.getCurLayer() + "&gid=" + gid, {})
        .pipe(
            retry(3)
          );
    }

    querySetLineDirection(gidA: number, gidB: number, mode: number) {
        return this.httpClient.put("http://172.25.182.2:8087/changeDirection?layer=" + this.getCurLayer() + "&gidA=" + gidA
            + "&gidB=" + gidB + "&mode=" + mode, {})
        .pipe(
            retry(3)
          );
    }

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

    getCurLayer(): string {
        return this.curLayer;
    }

    layerChange(): Observable<any>{
        return this.layerChangeObj.asObservable();
    }

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

    getPointsInRad(latLng: [number, number]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetPointsInRad(latLng).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

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
}