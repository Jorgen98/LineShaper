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

    private whoToAsk = environment.apiUrl;

    constructor(private httpClient: HttpClient) {
        this.isDBConnected(0);
    }

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

    queryClearData(type: string) {
        return this.httpClient.post(this.whoToAsk + "/clearRoutingData?type=" + type, {})
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

    queryPostCreateStops(stops: any) {
        return this.httpClient.post(this.whoToAsk + "/createStops?stops=" + JSON.stringify(stops), {})
                .pipe(
                    retry(3)
                );
    }

    queryPostSaveLines(lines: any) {
        return this.httpClient.post(this.whoToAsk + "/saveLines?lines=" + JSON.stringify(lines), {})
                .pipe(
                    retry(3)
                );
    }

    queryGetStopsInRad(latLng: [number, number], midPoints: boolean) {
        return this.httpClient.get(this.whoToAsk + "/stopsInRad?geom=" + JSON.stringify(latLng) + '&midPoints=' + midPoints, {})
        .pipe(
            retry(3)
          );
    }

    queryGetRoute(stops: any, layer: string) {
        return this.httpClient.get(this.whoToAsk + "/route?layer=" + layer + "&stops=" + JSON.stringify(stops), {})
        .pipe(
            retry(3)
          );
    }

    queryGetLinesInfo() {
        return this.httpClient.get(this.whoToAsk + "/lines", {})
        .pipe(
            retry(3)
          );
    }

    queryGetWholeLine(code: number, dir: string) {
        return this.httpClient.get(this.whoToAsk + "/lineRoute?code=" + code + "&dir=" + dir, {})
    }

    queryPostSaveLineCodes(lineCodes: any) {
        return this.httpClient.post(this.whoToAsk + "/saveLineCodes?lineCodes=" + JSON.stringify(lineCodes), {})
                .pipe(
                    retry(3)
                );
    }

    queryPostCreateMidPoint(endCodeA: any, endCodeB: any, midpoints: any) {
        return this.httpClient.post(this.whoToAsk + "/midPoint?endCodeA=" + endCodeA + "&endCodeB=" + endCodeB + "&midPoints=" + JSON.stringify(midpoints), {})
        .pipe(
            retry(3)
          );
    }

    queryPutUpdateMidPoint(endCodeA: any, endCodeB: any, midpoints: any) {
        return this.httpClient.put(this.whoToAsk + "/midPoint?endCodeA=" + endCodeA + "&endCodeB=" + endCodeB + "&midPoints=" + JSON.stringify(midpoints), {})
        .pipe(
            retry(3)
          );
    }

    queryDeleteMidPoint(endCodeA: any, endCodeB: any) {
        return this.httpClient.delete(this.whoToAsk + "/midPoint?endCodeA=" + endCodeA + "&endCodeB=" + endCodeB, {})
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

    // Get map tiles layer
    getCurLayer(): string {
        return this.curLayer;
    }

    // Change map tiles layer
    layerChange(): Observable<any>{
        return this.layerChangeObj.asObservable();
    }

    // Clear all routing data
    clearData(type: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryClearData(type).subscribe(response => {
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

    // Create more stops, used in import user case
    createPoints(stops: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostCreateStops(stops).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Save lines, used in import user case
    saveLines(lines: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostSaveLines(lines).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Get stops and its names around some point
    getStopsInRad(latLng: [number, number], midPoints: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetStopsInRad(latLng, midPoints).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Get route
    getRoute(stops: any, layer: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetRoute(stops, layer).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    getLinesInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetLinesInfo().subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    getWholeLine(code: number, dir: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetWholeLine(code, dir).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    // Save lineCodes, used in import user case
    saveLineCodes(lineCodes: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostSaveLineCodes(lineCodes).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Add new midpoint
    addMidpoint(endCodeA: any, endCodeB: any, midpoints: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPostCreateMidPoint(endCodeA, endCodeB, midpoints).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Update midpoint
    updateMidpoint(endCodeA: any, endCodeB: any, midpoints: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPutUpdateMidPoint(endCodeA, endCodeB, midpoints).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Delete midpoint
    deleteMidpoint(endCodeA: any, endCodeB: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryDeleteMidPoint(endCodeA, endCodeB).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }
}