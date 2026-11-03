import React from 'react';
import { useNavigate } from 'react-router-dom';

import { ArrowLeft, Home, FileQuestion } from 'lucide-react';
import { User } from '../types';

interface NotFoundPageProps {
  currentUser?: User | null;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (!currentUser) {
      navigate('/login');
    } else {
      navigate('/painel');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#141413] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative select-none">
      {/* Glow backgrounds */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#f6d35c]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-[#ea3324]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#1d1d1b] border border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl text-center relative z-10">
        <div className="flex justify-center mb-6">
          <img src="/brand/hummm-logo-escuro.svg" alt="hummm! Pizzas" className="h-11 w-auto" />
        </div>

        <div className="w-16 h-16 bg-[#f6d35c]/10 border border-[#f6d35c]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#f6d35c]">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="text-4xl font-extrabold font-mono text-[#f6d35c] tracking-wider mb-2">
          404
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Página não encontrada
        </h1>

        <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
          O endereço acessado não existe, foi movido ou você não possui autorização para este recurso.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar página anterior</span>
          </button>

          <button
            type="button"
            onClick={handleGoHome}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#f6d35c] hover:bg-[#f3c93f] text-[#1d1d1b] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ir para o Início</span>
          </button>
        </div>
      </div>
    </div>
  );
};
