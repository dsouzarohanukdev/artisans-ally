'use client';

import { useState, useEffect, FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// --- Type Definitions ---
type Listing = { listing_id: string | number; title: string; price: { amount: number; divisor: number; }; source: 'Etsy' | 'eBay'; };
type AnalysisBreakdown = { count: number; average_price: number; min_price: number; max_price: number; };
type ProfitScenario = { name: string; price: number; profit: number; };
type SeoAnalysis = { top_keywords: string[]; };
type AiContent = { titles: string[]; description: string; };
type Material = { id: number; name: string; cost: number; quantity: number; unit: string; cost_per_unit?: number; };
type RecipeItem = { material_id: string; quantity: string; };
type Product = { id: number; name: string; recipe: { material_id: number; quantity: number }[]; cogs?: number; };
type WorkshopData = { materials: Material[]; products: Product[]; };

export default function Home() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('jesmonite tray');
    const [materialCost, setMaterialCost] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [etsyListings, setEtsyListings] = useState<Listing[]>([]);
    const [ebayListings, setEbayListings] = useState<Listing[]>([]);
    const [overallAnalysis, setOverallAnalysis] = useState<AnalysisBreakdown | null>(null);
    const [etsyAnalysis, setEtsyAnalysis] = useState<AnalysisBreakdown | null>(null);
    const [ebayAnalysis, setEbayAnalysis] = useState<AnalysisBreakdown | null>(null);
    const [scenarios, setScenarios] = useState<ProfitScenario[]>([]);
    const [seoAnalysis, setSeoAnalysis] = useState<SeoAnalysis | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiContent, setAiContent] = useState<AiContent | null>(null);
    const [workshopData, setWorkshopData] = useState<WorkshopData>({ materials: [], products: [] });
    const [isWorkshopLoading, setIsWorkshopLoading] = useState(true);
    const [newMaterial, setNewMaterial] = useState({ name: '', cost: '', quantity: '', unit: 'g' });
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductRecipe, setNewProductRecipe] = useState<RecipeItem[]>([{ material_id: '', quantity: '' }]);
    const [isRelatedModalOpen, setIsRelatedModalOpen] = useState(false);
    const [relatedItems, setRelatedItems] = useState<Listing[]>([]);
    const [isRelatedLoading, setIsRelatedLoading] = useState(false);
    const [selectedListingTitle, setSelectedListingTitle] = useState('');
    const [activeTab, setActiveTab] = useState<'analysis' | 'workshop'>('analysis');
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<'etsy' | 'ebay'>('etsy');

    const fetchWorkshopData = async () => {
        setIsWorkshopLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workshop`, { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 401) {
                    setWorkshopData({ materials: [], products: [] });
                    return;
                }
                throw new Error("Failed to fetch workshop data");
            }
            const data = await response.json();
            setWorkshopData(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsWorkshopLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchWorkshopData();
        } else {
            setWorkshopData({ materials: [], products: [] });
            setIsWorkshopLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (selectedProductId) {
            const product = workshopData.products.find(p => p.id === parseInt(selectedProductId));
            if (product && product.cogs) {
                setMaterialCost(product.cogs.toFixed(2));
            }
        }
    }, [selectedProductId, workshopData.products]);

    useEffect(() => {
        if (!user) {
            setActiveTab('analysis');
        }
    }, [user]);

    const handleAnalyse = async () => {
        if (!materialCost) {
            setError("Please enter a material cost or select a product with a calculated cost first.");
            return;
        }
        setIsLoading(true); setError(''); setEtsyListings([]); setEbayListings([]);
        setOverallAnalysis(null); setEtsyAnalysis(null); setEbayAnalysis(null);
        setScenarios([]); setSeoAnalysis(null); setAiContent(null);
        setActiveTab('analysis'); setActiveAnalysisTab('etsy');
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyse?cost=${materialCost}&query=${searchTerm}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const analysisData = await response.json();
            setEtsyListings(analysisData.listings.etsy);
            setEbayListings(analysisData.listings.ebay);
            setOverallAnalysis(analysisData.analysis.overall);
            setEtsyAnalysis(analysisData.analysis.etsy);
            setEbayAnalysis(analysisData.analysis.ebay);
            setScenarios(analysisData.profit_scenarios);
            setSeoAnalysis(analysisData.seo_analysis);
        } catch (err) {
            setError('Failed to fetch data from the backend.'); console.error(err);
        } finally { setIsLoading(false); }
    };

    const handleGenerateContent = async () => {
        if (!seoAnalysis?.top_keywords) return;
        setIsGenerating(true); setError(''); setAiContent(null);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-content`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: seoAnalysis.top_keywords }),
                credentials: 'include'
            });
            if (!response.ok) throw new Error('AI content generation failed');
            const data = await response.json(); setAiContent(data);
        } catch (err) {
            setError('Failed to generate AI content.'); console.error(err);
        } finally { setIsGenerating(false); }
    };
    
    const handleAddMaterial = async (e: FormEvent) => {
        e.preventDefault();
        const materialToAdd = { name: newMaterial.name, cost: parseFloat(newMaterial.cost), quantity: parseFloat(newMaterial.quantity), unit: newMaterial.unit };
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/materials`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(materialToAdd),
                credentials: 'include'
            });
            if (!response.ok) throw new Error("Failed to add material");
            fetchWorkshopData();
            setNewMaterial({ name: '', cost: '', quantity: '', unit: 'g' });
        } catch (err) { console.error(err); setError("Failed to save new material."); }
    };

    const handleAddProduct = async (e: FormEvent) => {
        e.preventDefault();
        const productToAdd = { name: newProductName, recipe: newProductRecipe.filter(item => item.material_id && item.quantity).map(item => ({ material_id: parseInt(item.material_id), quantity: parseFloat(item.quantity) })) };
        if (productToAdd.name && productToAdd.recipe.length > 0) {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productToAdd),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error("Failed to add product");
                fetchWorkshopData();
                setIsProductModalOpen(false); setNewProductName(''); setNewProductRecipe([{ material_id: '', quantity: '' }]);
            } catch (err) { console.error(err); setError("Failed to save new product."); }
        }
    };

    const handleDeleteMaterial = async (materialId: number) => {
        if (!window.confirm('Are you sure you want to permanently delete this material?')) return;
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/materials/${materialId}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to delete material.');
            fetchWorkshopData();
        } catch (err) { console.error(err); setError('Could not delete the material.'); }
    };

    const handleDeleteProduct = async (productId: number) => {
        if (!window.confirm('Are you sure you want to permanently delete this product?')) return;
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/${productId}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to delete product.');
            fetchWorkshopData();
        } catch (err) { console.error(err); setError('Could not delete the product.'); }
    };
    
    const handleFindSimilar = async (itemId: string | number, title: string) => {
        setIsRelatedModalOpen(true); setIsRelatedLoading(true); setSelectedListingTitle(title);
        setRelatedItems([]); setError('');
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/related-items/${itemId}`);
            if (!response.ok) throw new Error("Failed to fetch related items.");
            const data = await response.json(); setRelatedItems(data.listings || []);
        } catch (err) {
            console.error(err); setError("Could not load related items at this time.");
            setTimeout(() => { setIsRelatedModalOpen(false); setError(''); }, 2000);
        } finally { setIsRelatedLoading(false); }
    };

    const handleRecipeChange = (index: number, field: 'material_id' | 'quantity', value: string) => {
        const updatedRecipe = [...newProductRecipe];
        updatedRecipe[index] = { ...updatedRecipe[index], [field]: value };
        setNewProductRecipe(updatedRecipe);
    };

    const removeRecipeItem = (index: number) => {
        const updatedRecipe = newProductRecipe.filter((_, i) => i !== index);
        if (updatedRecipe.length === 0) { setNewProductRecipe([{ material_id: '', quantity: '' }]); } else { setNewProductRecipe(updatedRecipe); }
    };
    
    const sortedEtsyListings = [...etsyListings].sort((a, b) => (a.price.amount / a.price.divisor) - (b.price.amount / b.price.divisor));
    const sortedEbayListings = [...ebayListings].sort((a, b) => (a.price.amount / a.price.divisor) - (b.price.amount / b.price.divisor));
    
    return (
        <>
            <Navbar />
            <main className="font-sans container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
                <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div><label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">1. Enter Product to Analyse</label><input type="text" id="searchTerm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" /></div>
                        <div><label htmlFor="productSelect" className="block text-sm font-medium text-gray-700">2. Select Your Product</label><select id="productSelect" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} disabled={!user} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"><option value="">-- Or enter cost manually below --</option>{workshopData.products.map(p => (<option key={p.id} value={p.id}>{p.name} (COGS: £{p.cogs?.toFixed(2)})</option>))}</select></div>
                    </div>
                    <div>
                        <label htmlFor="materialCost" className="block text-sm font-medium text-gray-700">3. Your Product's Material Cost (£)</label>
                        <input type="number" id="materialCost" value={materialCost} placeholder="Select a product or enter cost manually" onChange={(e) => { setMaterialCost(e.target.value); setSelectedProductId(''); }} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                        <p className="text-xs text-gray-500 mt-1">For an accurate number, log in and use the <button onClick={() => user ? setActiveTab('workshop') : router.push('/login')} className="font-semibold text-blue-600 hover:underline">Workshop Manager</button> to create a product recipe.</p>
                    </div>
                    <button onClick={handleAnalyse} disabled={isLoading} className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">{isLoading ? 'Analysing...' : 'Analyse Market'}</button>
                </div>
        
                {error && <p className="text-center text-red-500 mt-4 font-semibold">{error}</p>}
        
                <div className="max-w-5xl mx-auto">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('analysis')} className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeTab === 'analysis' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>Market Analysis</button>
                            {user && (<button onClick={() => setActiveTab('workshop')} className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeTab === 'workshop' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>Workshop Manager</button>)}
                        </nav>
                    </div>
                    <div className="mt-8">
                        {activeTab === 'analysis' && (
                            <div>
                                {isLoading ? (<p className="text-center text-gray-500 py-8">Analysing the market...</p>) : overallAnalysis ? (
                                    <div className="space-y-12">
                                        <div><div className="text-center mb-8"><h2 className="text-3xl font-bold text-gray-800">Your Profit Scenarios</h2><p className="text-md text-gray-500 mt-2">Calculated using your cost of <span className="font-semibold">£{parseFloat(materialCost).toFixed(2)}</span> against the overall market average of <span className="font-semibold">£{overallAnalysis.average_price.toFixed(2)}</span>.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{scenarios.map((s)=>(<div key={s.name} className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="font-semibold text-gray-800">{s.name}</h3><p className="text-sm text-gray-500 mb-2">Set Price at £{s.price.toFixed(2)}</p><p className="text-2xl font-bold text-green-600">£{s.profit.toFixed(2)}</p><p className="text-sm text-gray-500">Estimated Profit</p></div>))}</div></div>
                                        <div>
                                            <div className="border-b border-gray-200">
                                                <nav className="-mb-px flex gap-6" aria-label="Platform Tabs">
                                                    <button onClick={() => setActiveAnalysisTab('etsy')} className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeAnalysisTab === 'etsy' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>Etsy Analysis</button>
                                                    <button onClick={() => setActiveAnalysisTab('ebay')} className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeAnalysisTab === 'ebay' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>eBay Analysis</button>
                                                </nav>
                                            </div>
                                            <div className="mt-8">
                                                {activeAnalysisTab === 'etsy' && etsyAnalysis && (
                                                    <div className="space-y-8">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center"><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Listings Found</p><p className="text-xl font-bold text-gray-800">{etsyAnalysis.count}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Average Price</p><p className="text-xl font-bold text-orange-600">£{etsyAnalysis.average_price.toFixed(2)}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Price Range</p><p className="text-xl font-bold text-gray-800">£{etsyAnalysis.min_price.toFixed(2)} - £{etsyAnalysis.max_price.toFixed(2)}</p></div></div>
                                                        <div><h3 className="text-xl font-semibold text-gray-700 mb-4">Etsy Listings (Sorted by Price)</h3><div className="bg-white p-4 rounded-lg shadow-md"><ul className="divide-y divide-gray-200">{sortedEtsyListings.map((l)=>(<li key={`Etsy-${l.listing_id}`} className="py-3 flex justify-between items-center gap-4"><p className="text-gray-800 text-sm flex-1">{l.title}</p><span className="font-semibold text-gray-800 w-16 text-right">£{(l.price.amount / l.price.divisor).toFixed(2)}</span></li>))}</ul></div></div>
                                                        <div className="space-y-8">{seoAnalysis && (<div><h3 className="text-xl font-semibold text-gray-700 mb-4">SEO Assistant</h3><div className="bg-white p-6 rounded-lg shadow-md"><p className="text-sm text-gray-600 mb-4">Top keywords from similar Etsy listings:</p><div className="flex flex-wrap gap-2">{seoAnalysis.top_keywords.map((k)=>(<span key={k} className="bg-gray-200 text-gray-800 text-sm font-medium px-3 py-1 rounded-full">{k}</span>))}</div><button onClick={handleGenerateContent} disabled={isGenerating} className="mt-6 w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400">{isGenerating?'Generating...':'✨ Generate Titles & Description'}</button></div></div>)}{aiContent && (<div><h3 className="text-xl font-semibold text-gray-700 mb-4">AI Generated Content</h3><div className="bg-white p-6 rounded-lg shadow-md space-y-6"><div><h4 className="font-semibold text-gray-800">Suggested Titles:</h4><ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">{aiContent.titles.map((t,i)=><li key={i}>{t}</li>)}</ul></div><div><h4 className="font-semibold text-gray-800">Suggested Description:</h4><p className="mt-2 text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">{aiContent.description}</p></div></div></div>)}</div>
                                                    </div>
                                                )}
                                                {activeAnalysisTab === 'ebay' && ebayAnalysis && (
                                                    <div className="space-y-8">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center"><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Listings Found</p><p className="text-xl font-bold text-gray-800">{ebayAnalysis.count}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Average Price</p><p className="text-xl font-bold text-blue-600">£{ebayAnalysis.average_price.toFixed(2)}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Price Range</p><p className="text-xl font-bold text-gray-800">£{ebayAnalysis.min_price.toFixed(2)} - £{ebayAnalysis.max_price.toFixed(2)}</p></div></div>
                                                        <div><h3 className="text-xl font-semibold text-gray-700 mb-4">eBay Listings (Sorted by Price)</h3><div className="bg-white p-4 rounded-lg shadow-md"><ul className="divide-y divide-gray-200">{sortedEbayListings.map((l)=>(<li key={`eBay-${l.listing_id}`} className="py-3 flex justify-between items-center gap-2"><p className="text-gray-800 text-sm flex-1">{l.title}</p><span className="font-semibold text-gray-800 w-16 text-right">£{(l.price.amount / l.price.divisor).toFixed(2)}</span><button onClick={()=>handleFindSimilar(l.listing_id,l.title)} className="p-2 rounded-full hover:bg-gray-200" title="Find similar items on eBay"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button></li>))}</ul></div></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (<p className="text-center text-gray-500 py-8">Click "Analyse Market" to see results.</p>)}
                            </div>
                        )}
                        {activeTab === 'workshop' && (
                            <div>
                                {isAuthLoading ? (
                                    <p className="text-center text-gray-500 py-8">Loading user session...</p>
                                ) : !user ? (
                                    <div className="text-center text-gray-500 py-8 px-4 bg-white rounded-lg shadow-md">
                                        <h2 className="text-2xl font-bold text-gray-800">Welcome to the Workshop Manager!</h2>
                                        <p className="mt-2">This is your private space to manage materials and product recipes.</p>
                                        <p className="mt-4">Please <a href="/login" className="text-indigo-600 font-semibold hover:underline">log in</a> or <a href="/register" className="text-indigo-600 font-semibold hover:underline">register</a> to get started.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-semibold text-gray-700">Your Materials Inventory</h3>
                                            <div className="bg-white p-6 rounded-lg shadow-md">
                                                <h4 className="font-semibold text-gray-800 mb-4">Add a New Material</h4>
                                                <p className="text-sm text-gray-500 mb-4">For accurate costing, always enter materials in their base unit (e.g., enter a 5kg bag as 5000g).</p>
                                                <form onSubmit={handleAddMaterial} className="space-y-4">
                                                    <input type="text" placeholder="e.g., Jesmonite AC100 Powder" value={newMaterial.name} onChange={e=>setNewMaterial({...newMaterial,name:e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <input type="number" placeholder="Total Cost (£)" step="0.01" value={newMaterial.cost} onChange={e=>setNewMaterial({...newMaterial,cost:e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                                        <input type="number" placeholder="Total Qty (e.g., 5000)" value={newMaterial.quantity} onChange={e=>setNewMaterial({...newMaterial,quantity:e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                                        <select value={newMaterial.unit} onChange={e=>setNewMaterial({...newMaterial,unit:e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"><option value="g">grams (g)</option><option value="ml">milliliters (ml)</option><option value="unit">units</option><option value="pieces">pieces</option></select>
                                                    </div>
                                                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">Add Material</button>
                                                </form>
                                            </div>
                                            {isWorkshopLoading ? <p className="text-center py-4">Loading...</p> : workshopData.materials.length === 0 ? (<p className="text-center text-gray-500 py-4">Start by adding your raw materials above.</p>) : (
                                                <div className="bg-white p-4 rounded-lg shadow-md"><ul className="divide-y divide-gray-200">{workshopData.materials.map(m=>(<li key={m.id} className="py-3 flex justify-between items-center gap-4 text-sm"><div className="flex-1"><p className="font-semibold text-gray-800">{m.name}</p><p className="text-gray-500">£{m.cost.toFixed(2)} for {m.quantity} {m.unit} = <span className="font-semibold text-gray-700">£{m.cost_per_unit?.toFixed(4)} per {m.unit}</span></p></div><button onClick={() => handleDeleteMaterial(m.id)} className="px-2 py-1 text-xs font-bold text-red-500 bg-red-100 rounded-full hover:bg-red-200 hover:text-red-700" title="Delete Material">X</button></li>))}</ul></div>
                                            )}
                                        </div>
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-semibold text-gray-700">Your Products & Recipes</h3>
                                                <button onClick={() => setIsProductModalOpen(true)} disabled={workshopData.materials.length === 0} className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">New Product</button>
                                            </div>
                                            {isWorkshopLoading ? <p className="text-center py-4">Loading...</p> : workshopData.products.length === 0 ? (<div className="text-center text-gray-500 py-8 px-4 bg-white rounded-lg shadow-md"><p>No products yet.</p><p className="text-sm mt-2">Add materials first, then click "New Product" to create a recipe and calculate its cost (COGS).</p></div>) : (
                                                <div className="bg-white p-4 rounded-lg shadow-md"><ul className="divide-y divide-gray-200">{workshopData.products.map(p=>(<li key={p.id} className="py-3 flex justify-between items-center gap-4"><span className="font-semibold text-gray-800">{p.name}</span><div className="flex items-center gap-4"><span className="font-bold text-green-600" title="Cost of Goods Sold">COGS: £{p.cogs?.toFixed(2)}</span><button onClick={() => handleDeleteProduct(p.id)} className="px-2 py-1 text-xs font-bold text-red-500 bg-red-100 rounded-full hover:bg-red-200 hover:text-red-700" title="Delete Product">X</button></div></li>))}</ul></div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
        
                {isProductModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create a New Product Recipe</h2>
                            <form onSubmit={handleAddProduct}>
                                <label htmlFor="productName" className="block text-sm font-medium text-gray-700">Product Name</label>
                                <input type="text" id="productName" placeholder="e.g., Sage Green Tray" value={newProductName} onChange={e => setNewProductName(e.target.value)} required className="w-full mt-1 mb-6 px-3 py-2 border border-gray-300 rounded-md"/>
                                <h3 className="font-semibold text-gray-700 mb-2">Recipe Ingredients</h3>
                                <p className="text-xs text-gray-500 mb-4">Choose from your materials inventory. The quantity should be in the base unit (e.g., 'g' or 'ml') defined for the material.</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {newProductRecipe.map((item, index) => {
                                        const selectedMaterial = workshopData.materials.find(m => m.id === parseInt(item.material_id));
                                        return (
                                            <div key={index} className="flex gap-2 items-center">
                                                <select value={item.material_id} onChange={e => handleRecipeChange(index, 'material_id', e.target.value)} className="w-1/2 mt-1 block px-3 py-2 border border-gray-300 rounded-md">
                                                    <option value="">Select Material</option>
                                                    {workshopData.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                                <input type="number" placeholder="Qty" step="0.01" value={item.quantity} onChange={e => handleRecipeChange(index, 'quantity', e.target.value)} className="w-1/4 mt-1 block px-3 py-2 border border-gray-300 rounded-md"/>
                                                <span className="w-1/4 text-sm text-gray-500 pl-1">{selectedMaterial?.unit || ''}</span>
                                                <button type="button" onClick={() => removeRecipeItem(index)} className="text-red-500 hover:text-red-700 font-bold px-2">X</button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button type="button" onClick={() => setNewProductRecipe([...newProductRecipe, {material_id: '', quantity: ''}])} className="mt-4 text-sm text-blue-600 hover:underline">Add Ingredient</button>
                                <div className="flex justify-end gap-4 mt-8">
                                    <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">Save Product</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                {isRelatedModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <div><h2 className="text-xl font-bold text-gray-800">Similar Items</h2><p className="text-sm text-gray-500 truncate">Related to: "{selectedListingTitle}"</p></div>
                                <button onClick={() => setIsRelatedModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold text-2xl">&times;</button>
                            </div>
                            <div className="max-h-96 overflow-y-auto border-t pt-4">
                                {isRelatedLoading ? (<p className="text-center text-gray-500 py-8">Searching for similar items...</p>) : (
                                    <div>{relatedItems.length > 0 ? (<ul className="divide-y divide-gray-200">{relatedItems.map((item) => (<li key={item.listing_id} className="py-3 flex justify-between items-center gap-4"><p className="text-sm text-gray-800 flex-1">{item.title}</p><span className="font-semibold text-gray-800 w-20 text-right">£{(item.price.amount / item.price.divisor).toFixed(2)}</span></li>))}</ul>) : (<p className="text-center text-gray-500 py-8">No similar items were found.</p>)}</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}