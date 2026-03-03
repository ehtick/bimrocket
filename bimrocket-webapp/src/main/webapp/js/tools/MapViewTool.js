/*
 * MapViewTool.js
 *
 * @author nexus
 */

import { Tool } from "./Tool.js";
import { MapViewDialog } from "../ui/MapViewDialog.js";

class MapViewTool extends Tool
{
  constructor(application, options)
  {
    super(application);
    this.name = "mapView";
    this.label = "tool.mapView.label";
    this.help = "tool.mapView.help";
    this.className = "mapView";
    this.setOptions(options);
    application.addTool(this);

    const dialog = new MapViewDialog(application);
    this.dialog = dialog;

    dialog.onHide = () => this.application.useTool(null);

  }

  activate()
  {
    this.dialog.visible = true;
  }

  deactivate()
  {
    this.dialog.visible = false;
  }
}

export { MapViewTool };
