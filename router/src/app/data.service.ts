import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, retry, timeout } from 'rxjs';
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
    private headers = new HttpHeaders();

    constructor(private httpClient: HttpClient) {}

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

    queryLogIn(name: string, password: string) {
        let logInHeader = new HttpHeaders();
        logInHeader = logInHeader.set('Authorization', 'Basic ' + btoa(name + ':' + password));
        return this.httpClient.get(this.whoToAsk + "/login?type=router", {headers: logInHeader})
        .pipe(
            retry(1)
          );
    }

    queryClearData(type: string) {
        return this.httpClient.post(this.whoToAsk + "/clearRoutingData?type=" + type, {}, {headers: this.headers})
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

    queryPostCreateStops(stops: any) {
        return this.httpClient.post(this.whoToAsk + "/createStops?stops=" + JSON.stringify(stops), {}, {headers: this.headers})
                .pipe(
                    retry(3)
                );
    }

    queryPostSaveLines(lines: any) {
        return this.httpClient.post(this.whoToAsk + "/saveLines?lines=" + JSON.stringify(lines), {}, {headers: this.headers})
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

    queryGetRoute(stops: any, layer: string) {
        return this.httpClient.get(this.whoToAsk + "/route?layer=" + layer + "&stops=" + JSON.stringify(stops), {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetLinesInfo() {
        return this.httpClient.get(this.whoToAsk + "/lines", {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetWholeLine(code: number, dir: string) {
        return this.httpClient.get(this.whoToAsk + "/lineRoute?code=" + code + "&dir=" + dir, {headers: this.headers})
        .pipe(
            timeout(70 * 1000)
          );
    }

    queryGetWholeLineInfo(code: number, dir: string) {
        return this.httpClient.get(this.whoToAsk + "/lineRouteInfo?code=" + code + "&dir=" + dir, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryUpdateLineInfo(code: number, dir: string, route: string) {
        return this.httpClient.get(this.whoToAsk + "/updateLineRouteInfo?code=" + code + "&dir=" + dir + "&route=" + route, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetLineRoutesInfo(code: number) {
        return this.httpClient.get(this.whoToAsk + "/lineRoutesInfo?code=" + code, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryPostSaveLineCodes(lineCodes: any) {
        return this.httpClient.post(this.whoToAsk + "/saveLineCodes?lineCodes=" + JSON.stringify(lineCodes), {}, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryPostCreateMidPoint(endCodeA: any, endCodeB: any, midpoints: any) {
        return this.httpClient.post(this.whoToAsk + "/midPoint?endCodesA=" + JSON.stringify(endCodeA) + "&endCodesB=" + JSON.stringify(endCodeB) +
            "&midPoints=" + JSON.stringify(midpoints), {}, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryPutUpdateMidPoint(id: any, midpoints: any) {
        return this.httpClient.put(this.whoToAsk + "/midPoint?id=" + id + "&midPoints=" + JSON.stringify(midpoints), {}, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryDeleteMidPoint(id: any) {
        return this.httpClient.delete(this.whoToAsk + "/midPoint?id=" + id, {headers: this.headers})
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

    queryGetMidPointsById(id: number) {
        return this.httpClient.get(this.whoToAsk + "/midPointsByGid?id=" + id, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetRouting(reroute: boolean = false, cancel: boolean = false) {
        return this.httpClient.get(this.whoToAsk + "/routing?reroute=" + reroute + "&cancel=" + cancel, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetRoutedLine(code: number, dir: string) {
        return this.httpClient.get(this.whoToAsk + "/routedLine?code=" + code + "&dir=" + dir, {headers: this.headers})
        .pipe(
            retry(3)
          );
    }

    queryGetLang() {
        return this.httpClient.get(this.whoToAsk + "/lang")
        .pipe(
            retry(1)
          );
    }

    querySetLang(lang: string) {
        return this.httpClient.put(this.whoToAsk + "/lang?lang=" + lang, {})
        .pipe(
            retry(3)
          );
    }

    // Callable functions
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
                resolve(token);
            } else {
                resolve(token);
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
            },
            error => {
                console.log(error);
                resolve({});
            });
        });
    }

    getLineRoutesInfo(code: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetLineRoutesInfo(code).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    getWholeLineInfo(code: number, dir: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetWholeLineInfo(code, dir).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve({});
                }
            });
        });
    }

    updateLineRouteInfo(code: number, dir: string, route: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryUpdateLineInfo(code, dir, route).subscribe(response => {
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
    updateMidpoint(id: any, midpoints: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryPutUpdateMidPoint(id, midpoints).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Delete midpoint
    deleteMidpoint(id: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryDeleteMidPoint(id).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
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

    // Get 1000 midpoint records above some ID, used in export use case
    getMidPointsById(id: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetMidPointsById(id).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    routing(reroute: boolean = false, cancel: boolean = false): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetRouting(reroute, cancel).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    getRoutedLine(code: number, dir: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetRoutedLine(code, dir).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    getLang(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queryGetLang().subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }

    setLang(lang: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.querySetLang(lang).subscribe(response => {
                if (response) {
                    resolve(response);
                } else {
                    resolve(false);
                }
            });
        });
    }
}