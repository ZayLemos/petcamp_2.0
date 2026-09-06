'use client'

import { useMemo, useState } from 'react'

const categories = [
  { name: 'Coleiras', icon: '◌', tone: 'mint' },
  { name: 'Ração para gatos', icon: '⌁', tone: 'cream' },
  { name: 'Ração para cães', icon: '⌁', tone: 'peach' },
  { name: 'Sachês para gatos', icon: '▣', tone: 'lavender' },
  { name: 'Sachês para cães', icon: '▣', tone: 'blue' },
  { name: 'Higiene', icon: '✦', tone: 'yellow' },
  { name: 'Brinquedos', icon: '◇', tone: 'coral' },
  { name: 'Areias', icon: '≋', tone: 'sand' },
  { name: 'Rações', icon: '◒', tone: 'green' },
  { name: 'Coadjuvantes', icon: '✚', tone: 'rose' },
  { name: 'Farmácia', icon: '+', tone: 'red' },
]

export default function Page() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('Todos')

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase().trim()
    return categories.filter((category) => {
      const matchesSearch = !query || category.name.toLowerCase().includes(query)
      const matchesSelected = selected === 'Todos' || category.name === selected
      return matchesSearch && matchesSelected
    })
  }, [search, selected])

  return (
    <main className="min-h-screen bg-[#f8fbf8] text-[#18352c]">
      <header className="border-b border-[#e1ebe5] bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
          <a href="#inicio" className="flex items-center gap-3" aria-label="PetCamp início">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f6953] text-xl font-bold text-white">pc</span>
            <span className="text-xl font-bold tracking-tight text-[#1f6953]">PetCamp</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#557168] md:flex" aria-label="Navegação principal">
            <a className="text-[#1f6953]" href="#categorias">Categorias</a>
            <a href="#ofertas" className="transition-colors hover:text-[#1f6953]">Ofertas</a>
            <a href="#cuidados" className="transition-colors hover:text-[#1f6953]">Cuidados</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#557168] hover:bg-[#f1f7f3] sm:block">Entrar</button>
            <button aria-label="Abrir carrinho" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dce9e1] bg-white text-[#1f6953] shadow-sm">▱</button>
          </div>
        </div>
      </header>

      <section id="inicio" className="mx-auto max-w-7xl px-6 pb-10 pt-12 lg:px-10 lg:pt-16">
        <div className="grid items-center gap-10 rounded-[2rem] bg-[#e4f2e9] px-7 py-10 md:px-12 lg:grid-cols-[1fr_370px] lg:py-14">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#df795a]">Tudo para seu melhor amigo</p>
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-[#174d3e] md:text-6xl">Encontre tudo que seu pet precisa</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#557168]">Produtos selecionados para cuidar, alimentar e deixar a rotina do seu companheiro ainda mais feliz.</p>
            <div className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#d6e8dc]">
              <label htmlFor="search" className="sr-only">Buscar produtos</label>
              <span className="pl-3 text-lg text-[#7e9a8e]">⌕</span>
              <input id="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque por produto ou categoria" className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-[#18352c] outline-none placeholder:text-[#91a89e]" />
              <button className="rounded-xl bg-[#1f6953] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#185641]">Buscar</button>
            </div>
          </div>
          <div className="relative hidden h-52 items-center justify-center rounded-[2rem] bg-[#c8e6d3] lg:flex">
            <div className="absolute -right-3 -top-4 h-16 w-16 rounded-full bg-[#f2b397]" />
            <div className="z-10 text-center"><div className="text-7xl">♧</div><p className="mt-2 text-sm font-semibold text-[#27624f]">Amor em cada cuidado</p></div>
          </div>
        </div>
      </section>

      <section id="categorias" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#df795a]">Explore a loja</p><h2 className="text-3xl font-bold tracking-tight text-[#174d3e]">Compre por categoria</h2></div>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar categorias">
            {['Todos', 'Cães', 'Gatos'].map((filter) => <button key={filter} onClick={() => setSelected(filter === 'Todos' ? 'Todos' : '')} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${selected === filter || (filter !== 'Todos' && selected === '') ? 'bg-[#1f6953] text-white' : 'bg-white text-[#628074] ring-1 ring-[#dce9e1] hover:bg-[#edf6f0]'}`}>{filter}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredCategories.map((category) => <button key={category.name} onClick={() => setSelected(category.name)} className="group rounded-2xl bg-white p-4 text-left shadow-[0_3px_18px_rgba(39,83,63,0.06)] ring-1 ring-[#e4eee7] transition hover:-translate-y-1 hover:shadow-md"><div className={`mb-5 flex h-20 items-center justify-center rounded-xl text-4xl font-light text-[#1f6953] ${category.tone === 'mint' ? 'bg-[#dff2e5]' : category.tone === 'cream' ? 'bg-[#fff2d7]' : category.tone === 'peach' ? 'bg-[#fde4d8]' : category.tone === 'lavender' ? 'bg-[#eee7f8]' : category.tone === 'blue' ? 'bg-[#e1eff8]' : category.tone === 'yellow' ? 'bg-[#fff5c9]' : category.tone === 'coral' ? 'bg-[#fbe0d7]' : category.tone === 'sand' ? 'bg-[#f3ead8]' : category.tone === 'green' ? 'bg-[#dcefe2]' : category.tone === 'rose' ? 'bg-[#f8e1e7]' : 'bg-[#f9dddd]'}`}>{category.icon}</div><span className="block text-sm font-bold leading-5 text-[#31594b]">{category.name}</span><span className="mt-1 block text-xs text-[#8aa096]">Ver produtos <span aria-hidden="true">→</span></span></button>)}
        </div>
        {filteredCategories.length === 0 && <p className="rounded-2xl bg-white p-10 text-center text-[#6d877c]">Nenhuma categoria encontrada.</p>}
      </section>

      <section id="ofertas" className="border-t border-[#e1ebe5] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left lg:px-10"><div><h2 className="font-bold text-[#174d3e]">Cuidado que cabe na sua rotina</h2><p className="mt-1 text-sm text-[#789087]">Receba novidades e ofertas especiais da PetCamp.</p></div><button className="self-center rounded-full bg-[#f2b397] px-6 py-3 text-sm font-bold text-[#713d2b] hover:bg-[#edaa88] sm:self-auto">Ver ofertas</button></div></section>
    </main>
  )
}
