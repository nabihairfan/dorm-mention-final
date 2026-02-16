'use client';
import { useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Callback() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setTimeout(() => router.push('/'), 800);
    });
  }, [router]);

  return (
    <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f2f5'}}>
      <div style={{textAlign:'center'}}>
        <div className="spinner" style={{width:'50px', height:'50px', border:'5px solid #eee', borderTop:'5px solid #667eea', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
        <p style={{marginTop:'20px', fontWeight:'600', color:'#444'}}>Setting up your dashboard...</p>
      </div>
      <style jsx>{` @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}