import { useMemo } from 'react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import styles from './RichTextViewer.module.css';

const RichTextViewer = ({ content, className = '' }) => {
  const html = useMemo(() => {
    if (!content) return '';

    try {
      // Check if it's a JSON string
      const json = typeof content === 'string' ? JSON.parse(content) : content;
      
      // Basic check for Tiptap JSON structure
      if (json && json.type === 'doc') {
        return generateHTML(json, [
          StarterKit.configure({
            heading: {
              levels: [3, 4],
            },
          }),
          Link.configure({
            HTMLAttributes: {
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          }),
        ]);
      }
    } catch (e) {
      // Not a valid JSON or not Tiptap JSON, handle as plain text
    }

    // Default: Plain text with line breaks
    return content.replace(/\n/g, '<br />');
  }, [content]);

  const isHtml = html !== content && html.includes('<');

  if (isHtml) {
    return (
      <div 
        className={`${styles.viewer} ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <div className={`${styles.plainText} ${className}`}>{content}</div>;
};

/**
 * Utility to get plain text from Tiptap JSON for previews
 */
export const getPlainTextFromRichText = (content) => {
  if (!content) return '';
  try {
    const json = typeof content === 'string' ? JSON.parse(content) : content;
    if (json && json.type === 'doc') {
      // Simple recursive function to extract text
      const extractText = (nodes) => {
        return nodes.reduce((acc, node) => {
          if (node.text) return acc + node.text;
          if (node.content) return acc + ' ' + extractText(node.content);
          return acc;
        }, '').trim();
      };
      return extractText(json.content);
    }
  } catch (e) {
    // Fallback to original string
  }
  return content;
};

export default RichTextViewer;
