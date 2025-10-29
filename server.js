const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Uploads qovluğunu yarat
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer konfiqurasiyası
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Files metadata saxlamaq üçün
const filesMetadata = {};
const metadataFile = path.join(__dirname, 'files-metadata.json');

// Metadata yüklə
if (fs.existsSync(metadataFile)) {
    try {
        const data = fs.readFileSync(metadataFile, 'utf8');
        Object.assign(filesMetadata, JSON.parse(data));
    } catch (err) {
        console.error('Metadata yükləmə xətası:', err);
    }
}

// Metadata saxla
function saveMetadata() {
    fs.writeFileSync(metadataFile, JSON.stringify(filesMetadata, null, 2));
}

// ROUTES

// 1. Bütün faylları göstər
app.get('/api/files', (req, res) => {
    const files = Object.entries(filesMetadata).map(([id, data]) => ({
        id,
        ...data
    }));
    res.json(files);
});

// 2. Fayl yüklə
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Fayl tapılmadı' });
        }

        const fileId = req.file.filename;
        const metadata = {
            name: req.body.originalName || req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
            uploader: req.body.uploader || 'Anonim',
            date: new Date().toLocaleDateString('az-AZ'),
            timestamp: Date.now(),
            filename: fileId
        };

        filesMetadata[fileId] = metadata;
        saveMetadata();

        res.json({ 
            success: true, 
            message: 'Fayl yükləndi',
            file: { id: fileId, ...metadata }
        });
    } catch (error) {
        console.error('Upload xətası:', error);
        res.status(500).json({ error: 'Fayl yükləmə xətası' });
    }
});

// 3. Fayl endir
app.get('/api/download/:fileId', (req, res) => {
    try {
        const fileId = req.params.fileId;
        const metadata = filesMetadata[fileId];

        if (!metadata) {
            return res.status(404).json({ error: 'Fayl tapılmadı' });
        }

        const filePath = path.join(uploadsDir, fileId);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fayl diskdə tapılmadı' });
        }

        res.download(filePath, metadata.name);
    } catch (error) {
        console.error('Download xətası:', error);
        res.status(500).json({ error: 'Fayl endirmə xətası' });
    }
});

// 4. Fayl sil
app.delete('/api/delete/:fileId', (req, res) => {
    try {
        const fileId = req.params.fileId;
        const metadata = filesMetadata[fileId];

        if (!metadata) {
            return res.status(404).json({ error: 'Fayl tapılmadı' });
        }

        const filePath = path.join(uploadsDir, fileId);
        
        // Faylı diskdən sil
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Metadata-dan sil
        delete filesMetadata[fileId];
        saveMetadata();

        res.json({ success: true, message: 'Fayl silindi' });
    } catch (error) {
        console.error('Delete xətası:', error);
        res.status(500).json({ error: 'Fayl silmə xətası' });
    }
});

// Server başlat
app.listen(PORT, () => {
    console.log(`🚀 Server işləyir: http://localhost:${PORT}`);
    console.log(`📁 Uploads qovluğu: ${uploadsDir}`);
});
