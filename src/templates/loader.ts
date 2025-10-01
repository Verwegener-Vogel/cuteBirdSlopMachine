/**
 * Template loader for HTML templates
 * Loads and renders HTML templates with data
 */

import { galleryTemplate, GalleryTemplateData } from './gallery-template';
import { testPlayerTemplate } from './test-player-template';

export class TemplateLoader {
  /**
   * Load the test player HTML template
   */
  static getTestPlayer(): string {
    return testPlayerTemplate();
  }

  /**
   * Load and render the gallery template with data
   */
  static getGallery(data: GalleryTemplateData): string {
    return galleryTemplate(data);
  }
}

// Export types
export { GalleryTemplateData } from './gallery-template';
