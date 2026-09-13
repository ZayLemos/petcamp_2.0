"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { deleteSpreadsheetImports, importPromotionsFromExcel } from "@/app/actions/promotions"
import { TaskUpdatesChat } from "@/components/task-updates-chat";

interface TarefaVisual {
  produto: string;
  setor: string;
  inicio: string;
  termino: string;
}

export default function GerentePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalImportado, setTotalImportado] = useState(0);
  const [tarefas, setTarefas] = useState<TarefaVisual[]>([]);

  const handleDeleteSpreadsheetImports = async () => {
    if (!window.confirm("Apagar todas as promoções importadas por planilha? Cadastros manuais serão preservados.")) return
    const result = await deleteSpreadsheetImports()
    setTotalImportado(0)
    setTarefas([])
    alert(`${result.deleted} importação(ões) apagada(s).`)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Por favor, selecione um arquivo.");

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await importPromotionsFromExcel(formData);
      
      if (res.imported > 0) {
        setTotalImportado(res.imported);

        // Processa o texto localmente para renderizar a tabela na hora
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            const linhas = text.split(/\r?\n/).filter(l => l.trim() !== "");
            const sep = linhas[0].includes(";") ? ";" : ",";
            const cabecalho = linhas[0].split(sep).map(c => c.trim().toLowerCase());
            
            const idxProd = cabecalho.findIndex(c => c.includes("produto"));
            const idxSet = cabecalho.findIndex(c => c.includes("setor"));
            const idxIni = cabecalho.findIndex(c => c.includes("inicio") || c.includes("datainicio"));
            const idxTer = cabecalho.findIndex(c => c.includes("termino") || c.includes("datafinal"));

            const lista: TarefaVisual[] = [];
            linhas.slice(1).forEach(linha => {
              const colunas = linha.split(sep).map(v => v.trim());
              if (colunas[idxProd]) {
                lista.push({
                  produto: colunas[idxProd],
                  setor: idxSet !== -1 ? colunas[idxSet] : "Geral",
                  inicio: idxIni !== -1 ? colunas[idxIni] : "-",
                  termino: idxTer !== -1 ? colunas[idxTer] : "-"
                });
              }
            });
            setTarefas(lista);
          }
        };
        reader.readAsText(file);
        alert(`Planilha lida! ${res.imported} linhas processadas.`);
      } else {
        alert(res.errors?.length ? res.errors.join("\n") : "Nenhum produto foi identificado no arquivo.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-orange-600">
          <ArrowLeft className="size-4" />
          Voltar ao painel
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Importar Planilha Simplificada</h2>
          <p className="text-xs text-gray-400 mt-1">Envie o arquivo atualizado da PetCamp para processamento direto na tela.</p>
        </div>

        <form onSubmit={handleUploadSubmit} className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 w-full flex items-center gap-2 border border-gray-200 rounded-xl p-2 bg-gray-50">
            <label className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 shadow-sm text-gray-700">
              Escolher arquivo
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
            <span className="text-xs text-gray-500 truncate">{file ? file.name : "Nenhum arquivo escolhido"}</span>
          </div>
          
          <button type="submit" disabled={loading} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm py-2.5 px-6 rounded-xl shadow-sm disabled:opacity-50">
            {loading ? "Processando..." : "Importar planilha"}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600 font-medium"><span className="text-indigo-600 font-bold">{totalImportado}</span> item(ns) importado(s).</p>
          <button type="button" onClick={handleDeleteSpreadsheetImports} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Apagar importações da planilha</button>
        </div>

        <TaskUpdatesChat />

        {tarefas.length > 0 && (
          <div className="overflow-y-auto max-h-[400px] border border-gray-100 rounded-xl mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0">
                  <th className="p-3">Produto</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Início</th>
                  <th className="p-3">Término</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {tarefas.map((t, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 font-medium max-w-[300px] truncate">{t.produto}</td>
                    <td className="p-3">{t.setor}</td>
                    <td className="p-3 text-gray-400">{t.inicio}</td>
                    <td className="p-3 text-gray-400">{t.termino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
