import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})

export class MapService {
    private zoomInObj = new Subject<any>();
    private zoomOutObj = new Subject<any>();
    private changeBaseMapObj = new Subject<any>();
    private visibilityUpdateObj = new Subject<any>();
    private putRouteOnMapObj = new Subject<any>();

    private backgroundLayers: {[name: string]: boolean} = {
        'rail': false,
        'road': false,
        'tram': false
    }
    
    zoomIn() {
        this.zoomInObj.next(0);
    }

    zoomOut() {
        this.zoomOutObj.next(0);
    }

    changeBaseMap(id: number) {
        this.changeBaseMapObj.next(id);
    }

    visibilityUpdate() {
        this.visibilityUpdateObj.next(0);
    }

    putRouteOnMap(points: any) {
        this.putRouteOnMapObj.next(points);
    }
    
    zoomInEvent(): Observable<any>{
        return this.zoomInObj.asObservable();
    }

    zoomOutEvent(): Observable<any>{
        return this.zoomOutObj.asObservable();
    }

    changeBaseMapEvent(): Observable<any>{
        return this.changeBaseMapObj.asObservable();
    }

    visibilityUpdateEvent(): Observable<any>{
        return this.visibilityUpdateObj.asObservable();
    }

    putRouteOnMapEvent(): Observable<any>{
        return this.putRouteOnMapObj.asObservable();
    }

    getBackgroundLayersState() {
        return this.backgroundLayers;
    }

    flipBackgroundLayersState(layer: string) {
        this.backgroundLayers[layer] = !this.backgroundLayers[layer];
        this.visibilityUpdate();
    }
}