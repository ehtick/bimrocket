/*
 * ClipTool.js
 *
 * @author realor
 */

import { Tool } from "./Tool.js";
import { Solid } from "../core/Solid.js";
import { BSP } from "../core/BSP.js";

class ClipTool extends Tool
{
  constructor(application, options)
  {
    super(application);
    this.name = "clip";
    this.label = "tool.clip.label";
    this.help = "tool.clip.help";
    this.className = "clip";
    this.setOptions(options);
    application.addTool(this);
    this.immediate = true;
  }

  execute()
  {
    const application = this.application;
    let objects = application.selection.roots;
    let operands = [];
    for (let i = 0; i < objects.length && operands.length < 2; i++)
    {
      let object = objects[i];
      if (object instanceof Solid)
      {
        operands.push(object);
      }
    }
    if (operands.length >= 2)
    {
      let bsp1 = new BSP();
      let object1 = operands[0];
      let geometry1 = object1.geometry;
      let matrix1 = object1.matrixWorld;
      bsp1.fromSolidGeometry(geometry1, matrix1);

      let bsp2 = new BSP();
      let object2 = operands[1];
      let geometry2 = object2.geometry;
      let matrix2 = object2.matrixWorld;
      bsp2.fromSolidGeometry(geometry2, matrix2);

      let bspResult = bsp1.clip(bsp2);

      let solid = new Solid();
      solid.updateGeometry(bspResult.toSolidGeometry(), true);

      application.addObject(solid, null, false, true);
    }
  }
}

export { ClipTool };
