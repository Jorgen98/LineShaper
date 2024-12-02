import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
    selector: '[mapTiles]',
    standalone: false
})

export class AppDirective {
    constructor(public viewContainerRef: ViewContainerRef) { }
}