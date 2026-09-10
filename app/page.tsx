"use client";

import { useState } from "react";
import Papa from "papaparse";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ imported: 0, review: 0 });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setLoading(true);

    // 🛠️ Faz o parse do arquivo CSV diretamente no navegador
    Papa.parse(file, {
      header: true, // Converte a primeira linha em chaves do objeto
      skipEmptyLines: true,
      complete: async (results) => {
        const linhasPlanilha = results.data;

        try {
          // 📡 Envia as linhas extraídas para a sua API no Next.js
          const response = await fetch("/api/importar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: linhasPlanilha }),
          });

          const data = await response.json();
          
          // Atualiza os contadores na tela igual ao seu print
          setStatus({
            imported: data.imported || 0,
            review: data.review || 0,
          });
        } catch (error) {
          console.error("Erro ao conectar com a API:", error);
          setStatus({ imported: 0, review: linhasPlanilha.length });
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        console.error("Erro ao ler o arquivo CSV:", err);
        setLoading(false);
      }
    });
  };

  return (
    <div className="p-8 max-w-xl mx-auto bg-white rounded-xl shadow mt-10 font-sans">
      <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 bg-gray-50">
        <label className="cursor-pointer bg-white px-3 py-1.5 border rounded text-sm font-medium hover:bg-gray-100">
          Escolher arquivo
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>
        <span className="text-sm text-gray-600">
          {file ? file.name : "Nenhum arquivo escolhido"}
        </span>
      </div>

      <button
        onClick={handleUpload}
        disabled={loading}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? "Importando..." : "Iniciar Importação"}
      </button>

      {/* 📊 Painel de Status idêntico à sua imagem técnica */}
      <div className="mt-6 text-sm text-gray-700 border-t pt-4">
        <p>
          <span className="font-semibold text-green-600">{status.imported}</span> item(ns) importado(s).{" "}
          <span className="font-semibold text-red-600">{status.review}</span> linha(s) precisam de revisão.
        </p>
      </div>
    </div>
  );
}
