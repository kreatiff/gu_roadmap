import { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  CodeXml,
  Unlink
} from 'lucide-react';
import LinkModal from './LinkModal';
import styles from './RichTextEditor.module.css';

const MenuBar = ({ editor, onOpenLinkModal }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className={styles.menubar}>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`${styles.menuBtn} ${editor.isActive('bold') ? styles.isActive : ''}`}
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`${styles.menuBtn} ${editor.isActive('italic') ? styles.isActive : ''}`}
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <div className={styles.divider} />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${styles.menuBtn} ${editor.isActive('bulletList') ? styles.isActive : ''}`}
        title="Bullet List"
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${styles.menuBtn} ${editor.isActive('orderedList') ? styles.isActive : ''}`}
        title="Ordered List"
      >
        <ListOrdered size={18} />
      </button>
      <div className={styles.divider} />
      <button
        type="button"
        onClick={onOpenLinkModal}
        className={`${styles.menuBtn} ${editor.isActive('link') ? styles.isActive : ''}`}
        title="Add Link"
      >
        <LinkIcon size={18} />
      </button>
      {editor.isActive('link') && (
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className={styles.menuBtn}
          title="Remove Link"
        >
          <Unlink size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`${styles.menuBtn} ${editor.isActive('codeBlock') ? styles.isActive : ''}`}
        title="Code Block"
      >
        <CodeXml size={18} />
      </button>
    </div>
  );
};

const RichTextEditor = ({ value, onChange, placeholder = 'Write something...' }) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [initialLinkUrl, setInitialLinkUrl] = useState('');

  const content = (() => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
      // Fallback for plain text legacy data
      return value;
    }
  })();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3, 4],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: styles.editorLink,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  const handleOpenLinkModal = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    setInitialLinkUrl(previousUrl);
    setIsLinkModalOpen(true);
  }, [editor]);

  const handleSaveLink = useCallback((url) => {
    if (!editor) return;
    setIsLinkModalOpen(false);
    
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className={styles.editorWrapper}>
      <MenuBar editor={editor} onOpenLinkModal={handleOpenLinkModal} />
      <EditorContent editor={editor} className={styles.editorContent} />
      
      <LinkModal 
        isOpen={isLinkModalOpen}
        initialUrl={initialLinkUrl}
        onClose={() => setIsLinkModalOpen(false)}
        onSave={handleSaveLink}
      />
    </div>
  );
};

export default RichTextEditor;
