"use client";

import { useState } from "react";
import { importPromotionsFromExcel } from "@/app/actions"; // Ajuste o caminho caso o seu arquivo de actions fique em outro lugar

// Estrutura das tarefas para exibição visual
interface TarefaVisual {
  produto: string;
  setor: string;
  inicio: string;
  termino: string;
  status: string;
}

export default function GerentePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Estados para os contadores dinâmicos da tela
  const [status, setStatus] = useState({ imported: 0, review: 0 });
  const [tarefasCarregadas, setTarefasCarregadas] = useState<TarefaVisual[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Envio seguro que impede a quebra de renderização do Next.js
  const handleSubmitReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Por favor, escolha um arquivo antes de importar.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Executa a action de servidor sem recarregar a tela inteira
      const res = await importPromotionsFromExcel(formData);
      
      if (res.imported > 0) {
        setStatus({
          imported: res.imported,
          review: res.errors?.length || 0
        });

        // Simulação opcional: Lê o arquivo no front-end apenas para preencher a tabela visual imediatamente
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            const linhas = text.split(/\r?\n/).filter(l => l.trim() !== "");
            const primeiraLinha = linhas[0] || "";
            const sep = primeiraLinha.includes(";") ? ";" : ",";
            const cabecalho = primeiraLinha.split(sep).map(c => c.trim().toLowerCase());
            
            const idxProd = cabecalho.findIndex(c => c.includes("produto"));
            const idxSet = cabecalho.findIndex(c => c.includes("setor"));
            const idxIni = cabecalho.findIndex(c => c.includes("início") || c.includes("inicio"));
            const idxTer = cabecalho.findIndex(c => c.includes("término") || c.includes("termino"));

            const listaFormatada: TarefaVisual[] = [];
            linhas.slice(1).forEach(linha => {
              const colunas = linha.split(sep).map(v => v.trim());
              if (colunas[idxProd] && colunas[idxSet]) {
                listaFormatada.push({
                  produto: colunas[idxProd],
                  setor: colunas[idxSet],
                  inicio: idxIni !== -1 ? colunas[idxIni] : "-",
                  termino: idxTer !== -1 ? colunas[idxTer] : "-",
                  status: "Pendente"
                });
              }
            });
            setTarefasCarregadas(listaFormatada);
          }
        };
        reader.readAsText(file);

        alert(`Sucesso! ${res.imported} item(ns) processados com sucesso.`);
      } else {
        setStatus({ imported: 0, review: res.errors?.length || 22 });
        alert("Atenção: Nenhuma linha pôde ser importada. Revise o arquivo.");
      }
    } catch (err) {
      console.error("Erro na comunicação com a Server Action:", err);
      alert("Ocorreu um erro no servidor ao processar os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Topbar Roxa */}
      <header className="bg-[#4C1D95] text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 font-bold p-2 rounded-full w-10 h-10 flex items-center justify-center text-sm shadow">
            Pet
          </div>
          <div>
            <h1 className="text-lg font-bold">Conta do gerente</h1>
            <p className="text-xs text-purple-200">Acompanhe a equipe e importe tarefas</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Grid de Cards de Indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Tarefas concluídas</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">0</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Tarefas pendentes</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{status.imported}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-medium text-gray-400">Total acompanhado</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{status.imported}</p>
          </div>
        </div>

        {/* Card do Formulário de Importação */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">📄</span>
            <div>
              <h2 className="text-base font-bold text-gray-800">Importar planilha CSV</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Envie um arquivo .csv com produto, setor, início e término. As tarefas serão vinculadas no banco.
              </p>
            </div>
          </div>

          {/* Tag form controlada por JavaScript assíncrono */}
          <form onSubmit={handleSubmitReal} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl p-2 bg-gray-50/50">
              <label className="cursor-pointer bg-white px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700 whitespace-nowrap">
                Escolher arquivo
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
              <span className="text-xs text-gray-500 truncate max-w-[300px]">
                {file ? file.name : "Nenhum arquivo escolhido"}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm py-2.5 px-5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>📤</span> {loading ? "Processando..." : "Importar planilha"}
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-2">
            <span className="font-semibold text-emerald-600">{status.imported}</span> item(ns) importado(s).{" "}
            <span className="font-semibold text-rose-500">{status.review}</span> linha(s) precisam de revisão.
          </p>
        </div>

        {/* Card Histórico de Acompanhamento */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <h2 className="text-base font-bold text-gray-800">Acompanhamento por funcionário</h2>
          </div>

          {tarefasCarregadas.length === 0 ? (
            <p className="text-xs text-gray-400">Ainda não há tarefas importadas para exibição.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                    <th className="p-3">Produto</th>
                    <th className="p-3">Setor</th>
                    <th className="p-3">Início</th>
                    <th className="p-3">Término</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {tarefasCarregadas.map((tarefa, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-medium">{tarefa.produto}</td>
                      <td className="p-3">{tarefa.setor}</td>
                      <td className="p-3 text-gray-400">{tarefa.inicio}</td>
                      <td className="p-3 text-gray-400">{tarefa.termino}</td>
                      <td className="p-3">
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium text-[10px]">
                          {tarefa.status}
                        </span>
                      </td>
                    </tr>
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
