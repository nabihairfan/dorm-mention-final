'use client';
import { useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      console.log('Callback page loaded, processing session...');
      
      // This is the logic from your friend's code
      // It grabs the token from the URL hash and saves it locally
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error.message);
      } else {
        console.log('Session secured! Redirecting home...');
        // Small delay to ensure session is written to storage
        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
      <p>Completing sign-in...</p>
    </div>
  );
}