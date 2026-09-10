"use client";

import { useState } from "react";

// Tipo para estruturar as linhas genéricas que vêm da planilha
interface LinhaPlanilha {
  [key: string]: string;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ imported: 0, review: 0 });
  const [loading, setLoading] = useState(false);

  // Captura o arquivo quando o usuário clica no botão "Escolher arquivo"
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // Reseta os contadores ao trocar de arquivo
      setStatus({ imported: 0, review: 0 });
    }
  };

  // Processa o arquivo inteiro no próprio navegador (Frontend-only)
  const handleUpload = () => {
    if (!file) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setLoading(false);
    setLoading(true);

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setLoading(false);
        return;
      }

      // 🔍 Quebra o arquivo por linhas e remove linhas vazias
      const linhasRaw = text.split(/\r?\n/).filter(linha => linha.trim() !== "");
      
      if (linhasRaw.length <= 1) {
        alert("O arquivo está vazio ou não possui cabeçalho válido.");
        setLoading(false);
        return;
      }

      // Separa o cabeçalho (primeira linha) do restante dos dados
      const cabecalho = linhasRaw[0].split(",").map(c => c.trim().toLowerCase());
      const dados = linhasRaw.slice(1);

      let importados = 0;
      let revisao = 0;

      // Percorre cada uma das linhas de dados enviadas
      dados.forEach((linhaRaw) => {
        const valores = linhaRaw.split(",").map(v => v.trim());
        
        // Mapeia os dados da linha relacionando com as colunas do cabeçalho
        const item: LinhaPlanilha = {};
        cabecalho.forEach((coluna, index) => {
          item[coluna] = valores[index] || "";
        });

        // ⚠️ REGRAS DE VALIDAÇÃO (O que faz ir para sucesso ou revisão)
        // Pega o primeiro valor da linha como identificador ou nome
        const primeiroCampo = valores[0]; 

        // Modifique esta condição de acordo com as regras do seu Pet Shop!
        // Se a linha estiver vazia ou faltar o dado principal, ela vai direto para REVISÃO
        if (!primeiroCampo || primeiroCampo === "" || valores.length < cabecalho.length) {
          revisao++;
        } else {
          // Se passar nos critérios básicos, conta como IMPORTADO com sucesso
          importados++;
          console.log("Item lido com sucesso no sistema:", item);
        }
      });

      // Atualiza o painel visual com os estados calculados das linhas
      setStatus({
        imported: importados,
        review: revisao,
      });
      setLoading(false);
    };

    reader.onerror = () => {
      alert("Erro ao ler o arquivo físico.");
      setLoading(false);
    };

    // Lê o arquivo enviado como texto simples (.csv ou .txt)
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-xl mx-auto bg-white rounded-xl shadow mt-10 font-sans border border-gray-100">
      <h1 className="text-xl font-bold mb-4 text-gray-800">Importador de Arquivos - PetCamp</h1>
      
      {/* 📦 Input de Upload Idêntico ao Layout do seu Print Técnico */}
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
        <label className="cursor-pointer bg-white px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
          Escolher arquivo
          <input 
            type="file" 
            accept=".csv, .txt" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>
        <span className="text-sm text-gray-500 truncate max-w-[250px]">
          {file ? file.name : "Nenhum arquivo escolhido"}
        </span>
      </div>

      {/* Botão de Ação */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
      >
        {loading ? "Processando linhas..." : "Simular Importação de Dados"}
      </button>

      {/* 📊 Painel Dinâmico de Retorno de Status */}
      <div className="mt-6 text-sm text-gray-600 border-t border-gray-100 pt-4">
        <p className="leading-relaxed">
          <span className="font-semibold text-emerald-600">{status.imported}</span> item(ns) importado(s).{" "}
          <span className="font-semibold text-rose-500">{status.review}</span> linha(s) precisam de revisão.
        </p>
      </div>
    </div>
  );
}
