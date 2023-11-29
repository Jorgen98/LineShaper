import { HttpClient } from '@angular/common/http';
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

    private whoToAsk = 'http://localhost'; //http://172.25.182.2

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
        return this.httpClient.get(this.whoToAsk + ":8087/mapStats")
        .pipe(
            retry(3)
          );
    }

    queryClearData() {
        return this.httpClient.post(this.whoToAsk + ":8087/clearRoutingData", {})
        .pipe(
            retry(3)
          );
    }

    queryGetPointsInRad(latLng: [number, number], layer: string) {
        return this.httpClient.get(this.whoToAsk + ":8087/pointsInRad?layer=" + layer + "&geom=" + JSON.stringify(latLng), {})
        .pipe(
            retry(3)
          );
    }

    queryPostCreateStops(stops: any) {
        return this.httpClient.post(this.whoToAsk + ":8087/createStops?stops=" + JSON.stringify(stops), {})
                .pipe(
                    retry(3)
                );
    }

    queryGetStopsInRad(latLng: [number, number]) {
        return this.httpClient.get(this.whoToAsk + ":8087/stopsInRad?geom=" + JSON.stringify(latLng), {})
        .pipe(
            retry(3)
          );
    }

    queryGetRoute(stops: any, layer: string) {
        return this.httpClient.get(this.whoToAsk + ":8087/route?layer=" + layer + "&stops=" + JSON.stringify(stops), {})
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
    clearData(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryClearData().subscribe(response => {
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
}