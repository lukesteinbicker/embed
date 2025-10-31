// @ts-nocheck
import { useEffect, useState } from 'react';

interface AvatarProps {
  userName: string;
  userImage?: string | null;
}

export function Avatar({ userName, userImage }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (userImage) {
      setImageError(false);
      setImageLoaded(false);
    }
  }, [userImage]);

  const shouldShowImage = userImage && userImage.trim() && !imageError;

  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        backgroundColor: 'hsl(var(--muted))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {shouldShowImage ? (
        <>
          {!imageLoaded && (
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                backgroundColor: 'hsl(var(--muted))'
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <img
            src={userImage as string}
            alt={userName}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(false);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imageLoaded ? 'block' : 'none'
            }}
          />
        </>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            backgroundColor: 'hsl(var(--muted))'
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

