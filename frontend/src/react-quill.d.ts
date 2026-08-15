declare module 'react-quill' {
    import React from 'react';
    export interface ReactQuillProps {
        theme?: string;
        modules?: any;
        formats?: string[];
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        readOnly?: boolean;
        onChange?: (content: string, delta: any, source: any, editor: any) => void;
        style?: React.CSSProperties;
        className?: string;
        children?: React.ReactNode;
    }
    export default class ReactQuill extends React.Component<ReactQuillProps> { }
}
