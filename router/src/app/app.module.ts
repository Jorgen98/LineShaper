import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app';
import { MapComponent } from './map/map';
import { AppDirective } from './app.directive';
import { HttpClientModule } from '@angular/common/http';
import { FilesManipulationComponent } from './files-manipulation/files-manipulation';

@NgModule({
  declarations: [
    AppComponent,
    MapComponent,
    AppDirective,
    FilesManipulationComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    MatIconModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
