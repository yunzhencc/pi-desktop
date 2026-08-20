import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React from 'react';

export function Attachment() {
  const editorHostRef = React.useRef<HTMLDivElement>(null);
  const editorViewRef = React.useRef<EditorView | null>(null);

  React.useEffect(
    () => {
      if (!editorHostRef.current)
        return;

      const view = new EditorView(editorHostRef.current, {
        attributes: {
          'aria-multiline': 'true',
          'role': 'textbox',
        },
        handleDOMEvents: {},
        dispatchTransaction(transaction) {
          const nextState = view.state.apply(transaction);
          view.updateState(nextState);
          const nextText = nextState.doc.textContent;
          view.dom.dataset.empty = String(!nextText);
        },
        state: EditorState.create({
          plugins: [],
        }),
      });

      editorViewRef.current = view;

      return () => {
        editorViewRef.current = null;
        view.destroy();
      };
    },
    [],
  );

  return (
    <div className="chat-composer-editor" ref={editorHostRef} />
  );
}
