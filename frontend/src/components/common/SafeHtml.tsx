import React, { useMemo } from 'react';
import { sanitizeClientHtml } from '../../utils/sanitizeHtml';

export interface SafeHtmlProps extends React.HTMLAttributes<HTMLElement> {
  html: string | null | undefined;
  profile?: 'basic' | 'rich';
  as?: 'div' | 'span';
}

export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  profile = 'basic',
  as = 'div',
  className,
  style,
  ...rest
}) => {
  const cleanHtml = useMemo(() => {
    return sanitizeClientHtml(html, profile);
  }, [html, profile]);

  const Component = as;
  return (
    <Component
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      {...rest}
    />
  );
};

export default SafeHtml;
