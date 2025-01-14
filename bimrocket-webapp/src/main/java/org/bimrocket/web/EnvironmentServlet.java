/*
 * BIMROCKET
 *
 * Copyright (C) 2021, Ajuntament de Sant Feliu de Llobregat
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
package org.bimrocket.web;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.apache.commons.io.IOUtils;

/**
 *
 * @author realor
 */
@WebServlet(urlPatterns = {"/js/Environment.js"})
public class EnvironmentServlet extends HttpServlet
{
  public static String BIMROCKET_ENV = "BIMROCKET_ENV";
  private static final long serialVersionUID = 1L;

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp)
    throws ServletException, IOException
  {
    String source;
    File file = getEnvironmentFile();
    if (file != null)
    {
      try (InputStream fis = new FileInputStream(file))
      {
        source = IOUtils.toString(fis, "UTF-8");
      }
    }
    else
    {
      // use default Environment.js
      try (InputStream is =
           req.getServletContext().getResourceAsStream(req.getServletPath()))
      {
        source = IOUtils.toString(is, "UTF-8");
      }
    }

    resp.setContentType("text/javascript");
    resp.getWriter().println(source);
  }

  private File getEnvironmentFile()
  {
    String path;
    File file;

    path = System.getenv(BIMROCKET_ENV);
    if (path != null)
    {
      file = new File(path);
      if (file.exists()) return file;
    }

    path = System.getProperty(BIMROCKET_ENV);
    if (path != null)
    {
      file = new File(path);
      if (file.exists()) return file;
    }

    path = getServletContext().getInitParameter(BIMROCKET_ENV);
    if (path != null)
    {
      file = new File(path);
      if (file.exists()) return file;
    }

    path = System.getProperty("user.home") + "/Environment.js";
    file = new File(path);
    if (file.exists()) return file;

    return null;
  }
}
