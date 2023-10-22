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
}