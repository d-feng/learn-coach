import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API endpoint to save generated images
  app.post("/api/save-image", (req, res) => {
    const { slideId, imageData } = req.body;
    
    if (!slideId || !imageData) {
      return res.status(400).json({ error: "Missing slideId or imageData" });
    }

    try {
      const visualsDir = path.join(__dirname, "public", "visuals");
      if (!fs.existsSync(visualsDir)) {
        fs.mkdirSync(visualsDir, { recursive: true });
      }

      // Remove header from base64 string
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileName = `${slideId}.png`;
      const filePath = path.join(visualsDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      console.log(`Saved image: ${fileName}`);
      res.json({ success: true, path: `/visuals/${fileName}` });
    } catch (error) {
      console.error("Error saving image:", error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  // API endpoint to save slides text content
  app.post("/api/save-slides", (req, res) => {
    const { slides, lang } = req.body;
    
    if (!slides) {
      return res.status(400).json({ error: "Missing slides data" });
    }

    try {
      const fileName = lang && lang !== 'en' ? `slides_${lang}.json` : 'slides.json';
      const slidesPath = path.join(__dirname, "src", fileName);
      fs.writeFileSync(slidesPath, JSON.stringify(slides, null, 2));
      
      console.log(`Saved slides to ${slidesPath}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving slides:", error);
      res.status(500).json({ error: "Failed to save slides" });
    }
  });

  // API endpoint to export the entire project as a ZIP
  app.get("/api/export-project", async (req, res) => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const excludeDirs = ['node_modules', 'dist', '.git', '.next', '.cache'];
      const excludeFiles = ['.DS_Store', 'package-lock.json'];

      const addFilesToZip = (dirPath: string, zipFolder: any) => {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
              const newFolder = zipFolder.folder(file);
              addFilesToZip(fullPath, newFolder);
            }
          } else {
            if (!excludeFiles.includes(file)) {
              const content = fs.readFileSync(fullPath);
              zipFolder.file(file, content);
            }
          }
        }
      };

      addFilesToZip(__dirname, zip);
      
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=deep-discovery-project.zip');
      res.send(content);
    } catch (error) {
      console.error("Error exporting project:", error);
      res.status(500).json({ error: "Failed to export project" });
    }
  });

  // API endpoint to export the PRODUCTION version (read-only, scrollable)
  app.get("/api/export-production", async (req, res) => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const excludeDirs = ['node_modules', 'dist', '.git', '.next', '.cache'];
      const excludeFiles = ['.DS_Store', 'package-lock.json'];

      const addFilesToZip = (dirPath: string, zipFolder: any) => {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
              const newFolder = zipFolder.folder(file);
              addFilesToZip(fullPath, newFolder);
            }
          } else {
            if (!excludeFiles.includes(file)) {
              let content = fs.readFileSync(fullPath);
              
              // If it's App.tsx, modify it to enable production mode
              if (file === 'App.tsx' && fullPath.includes('src')) {
                let text = content.toString();
                text = text.replace('const IS_PRODUCTION_MODE = false;', 'const IS_PRODUCTION_MODE = true;');
                content = Buffer.from(text);
              }
              
              zipFolder.file(file, content);
            }
          }
        }
      };

      addFilesToZip(__dirname, zip);
      
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=deep-discovery-production.zip');
      res.send(content);
    } catch (error) {
      console.error("Error exporting production project:", error);
      res.status(500).json({ error: "Failed to export production project" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
