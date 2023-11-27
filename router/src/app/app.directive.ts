import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
    selector: '[mapTiles]',
})

export class AppDirective {
    constructor(public viewContainerRef: ViewContainerRef) { }
}