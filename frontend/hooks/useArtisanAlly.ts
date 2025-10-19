'use client';

import { useState, useEffect, FormEvent } from 'react';
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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const useArtisanAlly = () => {
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
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<'ebay' | 'etsy'>('ebay');
    const [displayMode, setDisplayMode] = useState<'curated' | 'full'>('curated');
    const [paginationCount, setPaginationCount] = useState(50);

    const fetchWorkshopData = async () => {
        setIsWorkshopLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/workshop`, { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 401) { setWorkshopData({ materials: [], products: [] }); return; }
                throw new Error("Failed to fetch workshop data");
            }
            const data = await response.json(); setWorkshopData(data);
        } catch (err) { console.error(err);
        } finally { setIsWorkshopLoading(false); }
    };

    useEffect(() => {
        if (user) { fetchWorkshopData(); } 
        else { setWorkshopData({ materials: [], products: [] }); setIsWorkshopLoading(false); }
    }, [user]);

    useEffect(() => {
        if (selectedProductId) {
            const product = workshopData.products.find(p => p.id === parseInt(selectedProductId));
            if (product && product.cogs) { setMaterialCost(product.cogs.toFixed(2)); }
        }
    }, [selectedProductId, workshopData.products]);

    useEffect(() => { if (!user) { setActiveTab('analysis'); } }, [user]);

    const handleAnalyse = async () => {
        if (!materialCost) { setError("Please enter a material cost or select a product."); return; }
        setIsLoading(true); setError(''); setEtsyListings([]); setEbayListings([]);
        setOverallAnalysis(null); setEtsyAnalysis(null); setEbayAnalysis(null);
        setScenarios([]); setSeoAnalysis(null); setAiContent(null);
        setActiveTab('analysis'); setActiveAnalysisTab('ebay');
        setDisplayMode('curated'); setPaginationCount(50);
        try {
            const response = await fetch(`${API_URL}/api/analyse?cost=${materialCost}&query=${searchTerm}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const analysisData = await response.json();
            setEbayListings(analysisData.listings.ebay);
            setEtsyListings(analysisData.listings.etsy); 
            setOverallAnalysis(analysisData.analysis.overall);
            setEbayAnalysis(analysisData.analysis.ebay);
            setEtsyAnalysis(analysisData.analysis.etsy); 
            setScenarios(analysisData.profit_scenarios);
            setSeoAnalysis(analysisData.seo_analysis);
        } catch (err) { setError('Failed to fetch data from the backend.'); console.error(err);
        } finally { setIsLoading(false); }
    };

    const handleGenerateContent = async () => {
        if (!seoAnalysis?.top_keywords || seoAnalysis.top_keywords.length === 0) {
            setError("No keywords found to generate content."); return;
        }
        setIsGenerating(true); setError(''); setAiContent(null);
        try {
            const response = await fetch(`${API_URL}/api/generate-content`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: seoAnalysis.top_keywords }),
                credentials: 'include'
            });
            if (!response.ok) throw new Error('AI content generation failed');
            const data = await response.json(); setAiContent(data);
        } catch (err) { setError('Failed to generate AI content.'); console.error(err);
        } finally { setIsGenerating(false); }
    };
    
    const handleAddMaterial = async (e: FormEvent) => {
        e.preventDefault();
        const materialToAdd = { name: newMaterial.name, cost: parseFloat(newMaterial.cost), quantity: parseFloat(newMaterial.quantity), unit: newMaterial.unit };
        try {
            const response = await fetch(`${API_URL}/api/materials`, {
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
                const response = await fetch(`${API_URL}/api/products`, {
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
            const response = await fetch(`${API_URL}/api/materials/${materialId}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to delete material.');
            fetchWorkshopData();
        } catch (err) { console.error(err); setError('Could not delete the material.'); }
    };

    const handleDeleteProduct = async (productId: number) => {
        if (!window.confirm('Are you sure you want to permanently delete this product?')) return;
        try {
            const response = await fetch(`${API_URL}/api/products/${productId}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to delete product.');
            fetchWorkshopData();
        } catch (err) { console.error(err); setError('Could not delete the product.'); }
    };
    
    const handleFindSimilar = async (itemId: string | number, title: string) => {
        setIsRelatedModalOpen(true); setIsRelatedLoading(true); setSelectedListingTitle(title);
        setRelatedItems([]); setError('');
        try {
            const response = await fetch(`${API_URL}/api/related-items/${itemId}`);
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
    
    const sortedEbayListings = [...ebayListings].sort((a, b) => (a.price.amount / a.price.divisor) - (b.price.amount / b.price.divisor));
    const sortedEtsyListings = [...etsyListings].sort((a, b) => (a.price.amount / a.price.divisor) - (b.price.amount / b.price.divisor));

    return {
        user, isAuthLoading, router,
        searchTerm, setSearchTerm,
        materialCost, setMaterialCost,
        isLoading, error,
        selectedProductId, setSelectedProductId,
        etsyListings, ebayListings,
        overallAnalysis, etsyAnalysis, ebayAnalysis,
        scenarios, seoAnalysis, isGenerating, aiContent,
        workshopData, isWorkshopLoading,
        newMaterial, setNewMaterial,
        isProductModalOpen, setIsProductModalOpen,
        newProductName, setNewProductName,
        newProductRecipe, setNewProductRecipe,
        isRelatedModalOpen, setIsRelatedModalOpen,
        relatedItems, isRelatedLoading, selectedListingTitle,
        activeTab, setActiveTab,
        activeAnalysisTab, setActiveAnalysisTab,
        handleAnalyse, handleGenerateContent,
        handleAddMaterial, handleAddProduct,
        handleDeleteMaterial, handleDeleteProduct,
        handleFindSimilar, handleRecipeChange, removeRecipeItem,
        sortedEbayListings, sortedEtsyListings,
        displayMode, setDisplayMode,
        paginationCount, setPaginationCount
    };
};