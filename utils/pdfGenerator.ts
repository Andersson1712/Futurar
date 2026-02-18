import { jsPDF } from 'jspdf';
import { generateStoryImage } from '../services/ai';
import { getChapterImage } from './images';

interface Dedication {
    text: string;
    position: 'start' | 'end';
}

interface GeneratePDFOptions {
    title: string;
    content: string;
    protagonist: string;
    scenery: string;
    mission: string;
    style: string;
    images?: Record<number, string>; // Pre-loaded images if any
    pages?: any[]; // Generated pages with content and images
    dedication?: Dedication;
    onProgress?: (status: string) => void;
}

const stripMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/#(.*?)\n/g, '$1') // Titles
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`/g, ''); // Code
};

// Helper to load image as base64
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('No canvas context'));
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
    });
};

export const generateStoryPDF = async ({
    title,
    content,
    protagonist,
    scenery,
    mission,
    style,
    images = {},
    pages: imagesFromPages, // Alias to avoid conflict with local vars
    dedication,
    onProgress
}: GeneratePDFOptions): Promise<void> => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Imagen de Portada (IA)
        try {
            // Check if we have a cover image (index 0)
            let finalCoverData = images[0];

            if (!finalCoverData) {
                const coverPrompt = `Portada de libro infantil. Título: ${title}. Protagonista: ${protagonist}. Escenario: ${scenery}. Estilo: ${style}. Sin texto.`;
                const coverBase64 = await generateStoryImage(coverPrompt, style);
                finalCoverData = coverBase64;
            }

            if (finalCoverData && finalCoverData.startsWith('http')) {
                finalCoverData = await loadImage(finalCoverData);
            }

            if (finalCoverData) {
                const imgWidth = 120;
                const imgHeight = 120;
                doc.addImage(finalCoverData, 'PNG', (pageWidth - imgWidth) / 2, 70, imgWidth, imgHeight);
            }
        } catch (e) {
            console.warn('Could not load cover image', e);
        }

        // Metadatos
        doc.setFontSize(14);
        doc.setTextColor(200, 200, 200);
        const metadataY = 210;
        doc.text(`Protagonista: ${protagonist}`, pageWidth / 2, metadataY, { align: 'center' });
        doc.text(`Escenario: ${scenery}`, pageWidth / 2, metadataY + 10, { align: 'center' });
        doc.text(`Misión: ${mission}`, pageWidth / 2, metadataY + 20, { align: 'center' });
        doc.text(`Estilo: ${style}`, pageWidth / 2, metadataY + 30, { align: 'center' });

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado con FUTURAR - Sistema de Acceso Universal", pageWidth / 2, pageHeight - 20, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-ES'), pageWidth / 2, pageHeight - 15, { align: 'center' });

        // --- DEDICATORIA (INICIO) ---
        if (dedication && dedication.position === 'start') {
            onProgress?.('Añadiendo dedicatoria...');
            doc.addPage();
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            // Marco simple
            doc.setDrawColor(200, 180, 140);
            doc.setLineWidth(1);
            doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));

            doc.setFont("times", "italic");
            doc.setFontSize(16);
            doc.setTextColor(50, 50, 50);

            const splitDedication = doc.splitTextToSize(dedication.text, contentWidth - 40);
            const textHeight = splitDedication.length * 10;

            doc.text(splitDedication, pageWidth / 2, pageHeight / 2 - textHeight / 2, { align: 'center' });
        }

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado con FUTURAR - Sistema de Acceso Universal", pageWidth / 2, pageHeight - 20, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-ES'), pageWidth / 2, pageHeight - 15, { align: 'center' });

        // --- CAPÍTULOS ---
        const cleanContent = stripMarkdown(content);

        // Determine source of chapters: from pages prop or parsing content
        let chaptersToRender: { title: string; content: string; imageUrl?: string; pageNum: number }[] = [];

        if (imagesFromPages && imagesFromPages.length > 0) {
            chaptersToRender = imagesFromPages.map((p, i) => ({
                title: `CAPÍTULO ${p.pageNumber}`,
                content: p.content,
                imageUrl: p.imageUrl,
                pageNum: p.pageNumber
            }));
        } else {
            const chapterSections = cleanContent.split(/CAPÍTULO \d+[:]?\s?/i).filter(s => s.trim().length > 20);
            const chapterTitles = cleanContent.match(/CAPÍTULO \d+[:]?\s?[^\n]*/gi) || [];

            chaptersToRender = chapterSections.map((section, idx) => ({
                title: (chapterTitles[idx] || `CAPÍTULO ${idx + 1}`).toUpperCase(),
                content: section.trim(),
                imageUrl: images[idx + 1],
                pageNum: idx + 1
            }));
        }

        for (let idx = 0; idx < chaptersToRender.length; idx++) {
            const chapter = chaptersToRender[idx];
            const section = chapter.content;
            const chapterNum = chapter.pageNum;

            onProgress?.(`Procesando capítulo ${chapterNum}...`);
            doc.addPage();

            // Fondo página
            doc.setFillColor(252, 252, 248);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            // Marco decorativo
            doc.setDrawColor(200, 180, 140);
            doc.setLineWidth(0.3);
            doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - (margin * 2) + 10);

            let currentY = 30;

            // Generar imagen de capítulo
            try {
                let finalImgData = chapter.imageUrl;

                // LEGACY fallback: If no image in page data, check images map or generate
                if (!finalImgData) {
                    finalImgData = images[chapterNum];
                }

                if (!finalImgData) {
                    // Only generate if we absolutely have no image from anywhere
                    onProgress?.(`Generando imagen faltante para capítulo ${chapterNum}...`);
                    const sceneContent = section.substring(0, 150).replace(/\n/g, ' ');
                    const imgPrompt = `Ilustración de cuento infantil. Capítulo ${chapterNum}. Protagonista: ${protagonist}. Escenario: ${scenery}. Acción: ${sceneContent}. Estilo: ${style}.`;
                    const imgData = await generateStoryImage(imgPrompt, style);
                    finalImgData = imgData;
                }

                if (finalImgData && finalImgData.startsWith('http')) {
                    finalImgData = await loadImage(finalImgData);
                }

                if (finalImgData) {
                    const imgW = contentWidth;
                    const imgH = 100;

                    // Maintain aspect ratio if possible, but fit within bounds
                    // For now keeping fixed 100 height as per design, could be improved

                    doc.addImage(finalImgData, 'PNG', margin, currentY, imgW, imgH);

                    doc.setDrawColor(150, 130, 100);
                    doc.setLineWidth(0.5);
                    doc.rect(margin, currentY, imgW, imgH);

                    currentY += imgH + 15;
                }
            } catch (e) {
                console.warn(`Could not gen image for chapter ${idx + 1}`, e);
                // Fallback attempt
                try {
                    const fallbackUrl = getChapterImage(scenery, chapterNum);
                    const imgBase64 = await loadImage(fallbackUrl);
                    const imgW = contentWidth;
                    const imgH = 80;
                    doc.addImage(imgBase64, 'JPEG', margin, currentY, imgW, imgH);
                    currentY += imgH + 15;
                } catch (e2) {
                    currentY += 10;
                }
            }

            // Título del capítulo
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(100, 70, 0);

            const wrappedTitle = doc.splitTextToSize(chapter.title, contentWidth);
            doc.text(wrappedTitle, pageWidth / 2, currentY, { align: 'center' });
            currentY += (wrappedTitle.length * 8) + 5;

            // Línea separadora
            doc.setDrawColor(250, 204, 21);
            doc.setLineWidth(0.5);
            doc.line(pageWidth / 2 - 25, currentY, pageWidth / 2 + 25, currentY);
            currentY += 15;

            // Contenido Texto
            doc.setFont("times", "normal");
            doc.setFontSize(11);
            doc.setTextColor(30, 30, 30);
            const bodyLines = doc.splitTextToSize(section, contentWidth);

            bodyLines.forEach((line: string) => {
                if (currentY > pageHeight - margin - 15) {
                    doc.addPage();
                    doc.setFillColor(252, 252, 248);
                    doc.rect(0, 0, pageWidth, pageHeight, 'F');

                    doc.setDrawColor(200, 180, 140);
                    doc.setLineWidth(0.3);
                    doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - (margin * 2) + 10);

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(150, 130, 100);
                    doc.text(chapter.title, pageWidth / 2, 15, { align: 'center' });

                    currentY = 30;
                    doc.setFont("times", "normal");
                    doc.setFontSize(11);
                    doc.setTextColor(30, 30, 30);
                }
                doc.text(line, margin, currentY);
                currentY += 6;
            });

            // Número de página
            doc.setFontSize(10);
            doc.setTextColor(150, 130, 100);
            doc.text(`${idx + 2}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        // --- DEDICATORIA (FINAL) ---
        if (dedication && dedication.position === 'end') {
            doc.addPage();
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            // Marco simple
            doc.setDrawColor(200, 180, 140);
            doc.setLineWidth(1);
            doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));

            doc.setFont("times", "italic");
            doc.setFontSize(16);
            doc.setTextColor(50, 50, 50);

            const splitDedication = doc.splitTextToSize(dedication.text, contentWidth - 40);
            const textHeight = splitDedication.length * 10;

            doc.text(splitDedication, pageWidth / 2, pageHeight / 2 - textHeight / 2, { align: 'center' });
        }

        // Guardar PDF
        const fileName = `${protagonist.replace(/\s+/g, '_')}_en_${scenery.replace(/\s+/g, '_')}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};
