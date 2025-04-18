/*
 * BIMROCKET
 *
 * Copyright (C) 2021-2025, Ajuntament de Sant Feliu de Llobregat
 *
 * This program is licensed and may be used, modified and redistributed under
 * the terms of the European Public License (EUPL), either version 1.1 or (at
 * your option) any later version as soon as they are approved by the European
 * Commission.
 *
 * Alternatively, you may redistribute and/or modify this program under the
 * terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation; either  version 3 of the License, or (at your option)
 * any later version.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the licenses for the specific language governing permissions, limitations
 * and more details.
 *
 * You should have received a copy of the EUPL1.1 and the LGPLv3 licenses along
 * with this program; if not, you may find them at:
 *
 * https://joinup.ec.europa.eu/software/page/eupl/licence-eupl
 * http://www.gnu.org/licenses/
 * and
 * https://www.gnu.org/licenses/lgpl.txt
 */

package org.bimrocket.service.ifcdb;

import java.util.ArrayList;
import com.orientechnologies.orient.core.db.document.ODatabaseDocument;
import com.orientechnologies.orient.core.metadata.schema.OSchema;
import com.orientechnologies.orient.core.record.OElement;
import java.util.List;
import org.bimrocket.express.*;
import org.bimrocket.step.io.DefinedTypeStepBuilder;
import org.bimrocket.step.io.EntityStepBuilder;
import org.bimrocket.step.io.ListBuilder;
import org.bimrocket.step.io.StepBuilder;
import org.bimrocket.step.io.StepLoader;

/**
 *
 * @author realor
 */
public class OrientStepLoader extends StepLoader<OElement>
{
  ODatabaseDocument db;
  OElement ifcModel;
  List<OElement> entities;

  public OrientStepLoader(ODatabaseDocument db, ExpressSchema schema)
  {
    super(schema);
    this.db = db;
  }

  @Override
  public StepBuilder<? extends Object> createBuilder(ExpressType type)
  {
    if (type instanceof ExpressEntity)
    {
      return new OElementBuilder((ExpressEntity)type);
    }
    else if (type instanceof ExpressDefinedType)
    {
      return new SimpleOElementBuilder((ExpressDefinedType)type);
    }
    else if (type instanceof ExpressCollection)
    {
      return new ListBuilder((ExpressCollection)type, new ArrayList<>());
    }
    return null;
  }

  @Override
  protected OElement createModel()
  {
    ifcModel = db.newElement("IfcModel");
    entities = new ArrayList<>();
    ifcModel.setProperty("Id", "?");
    ifcModel.setProperty("Name", "?");
    ifcModel.setProperty("Entities", entities);

    return ifcModel;
  }

  class OElementBuilder extends EntityStepBuilder<OElement>
  {
    OElementBuilder(ExpressEntity type)
    {
      createClassIfNotExists(type);

      this.type = type;
      this.instance = db.newElement(type.getName());
      entities.add(instance);
    }

    @Override
    public void set(String attributeName, Object item)
    {
      instance.setProperty(attributeName, item);
      if ("Name".equals(attributeName) && "IfcProject".equals(type.getName()))
      {
        ifcModel.setProperty("Name", String.valueOf(item));
      }
    }
  }

  class SimpleOElementBuilder extends DefinedTypeStepBuilder<OElement>
  {
    SimpleOElementBuilder(ExpressDefinedType type)
    {
      createClassIfNotExists(type);

      this.type = type;
      this.instance = db.newElement(type.getName());
      entities.add(instance);
    }

    @Override
    public void set(int index, Object item)
    {
      instance.setProperty("value", item);
    }
  }

  protected void createClassIfNotExists(ExpressEntity type)
  {
    OSchema schema = db.getMetadata().getSchema();
    if (schema.getClass(type.getName()) == null)
    {
      db.createClass(type.getName());
    }
  }

  protected void createClassIfNotExists(ExpressDefinedType type)
  {
    OSchema schema = db.getMetadata().getSchema();
    if (schema.getClass(type.getName()) == null)
    {
      db.createClass(type.getName());
    }
  }
}
