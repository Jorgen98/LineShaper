import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})

export class MapService {
    private zoomInObj = new Subject<any>();
    private zoomOutObj = new Subject<any>();
    private onNewItemAddObj = new Subject<any>();
    private changeBaseMapObj = new Subject<any>();
    private visibilityUpdateObj = new Subject<any>();

    private backgroundLayers: {[name: string]: boolean} = {
        'rail': false,
        'road': false,
        'tram': false,
        'midPoints': false,
        'stops': false
    }
    
    zoomIn() {
        this.zoomInObj.next(0);
    }

    zoomOut() {
        this.zoomOutObj.next(0);
    }

    onNewItemAdd(command: string) {
        this.onNewItemAddObj.next(command);
    }

    changeBaseMap(id: number) {
        this.changeBaseMapObj.next(id);
    }

    visibilityUpdate() {
        this.visibilityUpdateObj.next(0);
    }
    
    zoomInEvent(): Observable<any>{
        return this.zoomInObj.asObservable();
    }

    zoomOutEvent(): Observable<any>{
        return this.zoomOutObj.asObservable();
    }

    onNewItemAddEvent(): Observable<any>{
        return this.onNewItemAddObj.asObservable();
    }

    changeBaseMapEvent(): Observable<any>{
        return this.changeBaseMapObj.asObservable();
    }

    visibilityUpdateEvent(): Observable<any>{
        return this.visibilityUpdateObj.asObservable();
    }

    getBackgroundLayersState() {
        return this.backgroundLayers;
    }

    flipBackgroundLayersState(layer: string) {
        this.backgroundLayers[layer] = !this.backgroundLayers[layer];
        this.visibilityUpdate();
    }
}