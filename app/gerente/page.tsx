"use client";

import { useState } from "react";

interface Tarefa {
  produto: string;
  setor: string;
  inicio: string;
  termino: string;
  status: "Pendente" | "Concluída";
}

export default function GerentePage() {
  const [file, setFile] = useState<File | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [status, setStatus] = useState({ imported: 0, review: 0 });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  const handleImportar = () => {
    if (!file) {
      alert("Por favor, selecione um arquivo CSV (.csv) primeiro.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setLoading(false);
          return;
        }

        const linhasRaw = text.split(/\r?\n/).filter(linha => linha.trim() !== "");
        if (linhasRaw.length <= 1) {
          alert("O arquivo está vazio ou não possui o cabeçalho correto.");
          setLoading(false);
          return;
        }

        const primeiraLinha = linhasRaw[0];
        const separador = primeiraLinha.includes(";") ? ";" : ",";
        const cabecalho = primeiraLinha.split(separador).map(c => c.trim().toLowerCase());
        const linhasDados = linhasRaw.slice(1);

        const idxProduto = cabecalho.findIndex(c => c.includes("produto"));
        const idxSetor = cabecalho.findIndex(c => c.includes("setor"));
        const idxInicio = cabecalho.findIndex(c => c.includes("início") || c.includes("inicio"));
        const idxTermino = cabecalho.findIndex(c => c.includes("término") || c.includes("termino"));

        let importadosValidos: Tarefa[] = [];
        let erros = 0;

        linhasDados.forEach((linhaRaw) => {
          const valores = linhaRaw.split(separador).map(v => v.trim());
          if (idxProduto === -1 || idxSetor === -1 || valores.length < Math.max(idxProduto, idxSetor) + 1) {
            erros++;
            return;
          }

          const produto = valores[idxProduto];
          const setor = valores[idxSetor];
          const inicio = idxInicio !== -1 ? valores[idxInicio] : "";
          const termino = idxTermino !== -1 ? valores[idxTermino] : "";

          if (!produto || !setor) {
            erros++;
          } else {
            importadosValidos.push({ produto, setor, inicio, termino, status: "Pendente" });
          }
        });

        setTarefas(importadosValidos);
        setStatus({ imported: importadosValidos.length, review: erros });
      } catch (error) {
        console.error("Erro ao processar o arquivo CSV:", error);
        alert("Erro ao ler o arquivo CSV.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const concluidas = tarefas.filter(t => t.status === "Concluída").length;
  const pendentes = tarefas.filter(t => t.status === "Pendente").length;
  const total = tarefas.length;
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <header className="bg-[#4C1D95] text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 font-bold p-2 rounded-full w-10 h-10 flex items-center justify-center text-sm shadow">Pet</div>
          <div>
            <h1 className="text-lg font-bold">Conta do gerente</h1>
            <p className="text-xs text-purple-200">Acompanhe a equipe e importe tarefas</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Tarefas concluídas</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{concluidas}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Tarefas pendentes</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{pendentes}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Total acompanhado</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">📄</span>
            <div>
              <h2 className="text-base font-bold text-gray-800">Importar planilha CSV</h2>
              <p className="text-xs text-gray-400 mt-0.5">Envie um arquivo .csv com produto, setor, início e término.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl p-2 bg-gray-50/50">
              <label className="cursor-pointer bg-white px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 text-gray-700 whitespace-nowrap">
                Escolher arquivo
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
              <span className="text-xs text-gray-500 truncate max-w-[300px]">{file ? file.name : "Nenhum arquivo escolhido"}</span>
            </div>
            <button onClick={handleImportar} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm py-2.5 px-5 rounded-xl disabled:opacity-50">
              {loading ? "Processando..." : "Importar planilha"}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            <span className="font-semibold text-gray-700">{status.imported}</span> item(ns) importado(s).{" "}
            <span className="font-semibold text-gray-700">{status.review}</span> linha(s) precisam de revisão.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-800">Acompanhamento por funcionário</h2>
          {tarefas.length === 0 ? (
            <p className="text-xs text-gray-400">Ainda não há tarefas importadas.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-100"><th className="p-3">Produto</th><th className="p-3">Setor</th><th className="p-3">Início</th><th className="p-3">Término</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {tarefas.map((t, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50"><td className="p-3 font-medium">{t.produto}</td><td className="p-3">{t.setor}</td><td className="p-3 text-gray-400">{t.inicio || "-"}</td><td className="p-3 text-gray-400">{t.termino || "-"}</td><td className="p-3"><span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[10px]">{t.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
