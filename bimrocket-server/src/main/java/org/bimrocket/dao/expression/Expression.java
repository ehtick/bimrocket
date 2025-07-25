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
package org.bimrocket.dao.expression;

/**
 *
 * @author realor
 */
public abstract class Expression
{
  // expression types
  public static final String STRING = "STRING";
  public static final String NUMBER = "NUMBER";
  public static final String BOOLEAN = "BOOLEAN";
  public static final String NULL = "NULL";
  public static final String ANY = "ANY";

  public abstract String getType();

  public static Expression toExpression(Object value)
  {
    if (value instanceof Expression) return (Expression)value;
    return Literal.valueOf(value);
  }

  public static Expression property(String name)
  {
    return new Property(name);
  }

  public static Expression fn(Function function, Object ...arguments)
  {
    FunctionCall functionCall = new FunctionCall(function);
    for (Object argument : arguments)
    {
      functionCall.getArguments().add(toExpression(argument));
    }
    return functionCall;
  }
}
