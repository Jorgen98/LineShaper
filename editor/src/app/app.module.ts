import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from './app';
import { MapComponent } from './map/map';
import { AppDirective } from './app.directive';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FilesManipulationComponent } from './files-manipulation/files-manipulation';
import { LayerSelectComponent } from './layer-select/layer-select';

export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    MapComponent,
    AppDirective,
    FilesManipulationComponent,
    LayerSelectComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    MatIconModule,
    HttpClientModule,
    FormsModule,
    HttpClientModule,
    TranslateModule.forRoot({
      defaultLanguage: 'cz',
      loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
      }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }