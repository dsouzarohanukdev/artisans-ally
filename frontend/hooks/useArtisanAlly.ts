'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// --- Type Definitions ---
type Listing = { listing_id: string | number; title: string; price: { amount: number; divisor: number; }; source: 'eBay'; };
type AnalysisBreakdown = { count: number; average_price: number; min_price: number; max_price: number; };
type ProfitScenario = { name: string; price: number; profit: number; };
type Material = { id: number; name: string; cost: number; quantity: number; unit: string; cost_per_unit?: number; };
type RecipeItem = { material_id: string; quantity: string; };
type Product = { 
    id: number; 
    name: string; 
    recipe: { material_id: number; quantity: number }[];
    labour_hours: number;
    hourly_rate: number;
    profit_margin: number;
    material_cost: number;
    labour_cost: number;
    total_cost: number;
    suggested_price: number;
};
type WorkshopData = { materials: Material[]; products: Product[]; };

// const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_URL = '';

export const useArtisanAlly = () => {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('jesmonite tray');
    const [totalCost, setTotalCost] = useState(''); // Renamed from materialCost
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    
    // --- NEW: State for the smart combobox ---
    const [isProductListOpen, setIsProductListOpen] = useState(false);
    
    const [ebayListings, setEbayListings] = useState<Listing[]>([]);
    const [overallAnalysis, setOverallAnalysis] = useState<AnalysisBreakdown | null>(null);
    const [ebayAnalysis, setEbayAnalysis] = useState<AnalysisBreakdown | null>(null);
    const [scenarios, setScenarios] = useState<ProfitScenario[]>([]);
    const [workshopData, setWorkshopData] = useState<WorkshopData>({ materials: [], products: [] });
    const [isWorkshopLoading, setIsWorkshopLoading] = useState(true);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [materialForm, setMaterialForm] = useState({ name: '', cost: '', quantity: '', unit: 'g' });
    const [productForm, setProductForm] = useState({
        name: '',
        recipe: [{ material_id: '', quantity: '' }] as RecipeItem[],
        labourHours: '0.5',
        hourlyRate: '15',
        profitMargin: '100'
    });
    const [isRelatedModalOpen, setIsRelatedModalOpen] = useState(false);
    const [relatedItems, setRelatedItems] = useState<Listing[]>([]);
    const [isRelatedLoading, setIsRelatedLoading] = useState(false);
    const [selectedListingTitle, setSelectedListingTitle] = useState('');
    const [activeTab, setActiveTab] = useState<'analysis' | 'workshop'>('analysis');
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<'ebay' | 'etsy'>('ebay');
    const [displayMode, setDisplayMode] = useState<'curated' | 'full'>('curated');
    const [paginationCount, setPaginationCount] = useState(50);

    // --- NEW: State for internationalization ---
    const [marketplace, setMarketplace] = useState('EBAY_GB');
    const [currencySymbol, setCurrencySymbol] = useState('£');

    // --- NEW: Effect to update symbol when user changes currency ---
    useEffect(() => {
        if (user?.currency === 'USD') setCurrencySymbol('$');
        else if (user?.currency === 'EUR') setCurrencySymbol('€');
        else setCurrencySymbol('£');
    }, [user?.currency]);

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
            if (product && product.total_cost) {
                setTotalCost(product.total_cost.toFixed(2));
            }
        }
    }, [selectedProductId, workshopData.products]);

    useEffect(() => { if (!user) { setActiveTab('analysis'); } }, [user]);

    const handleAnalyse = async () => {
        if (!totalCost) { setError("Please enter your product's total cost first."); return; }
        setIsLoading(true); setError(''); setEbayListings([]);
        setOverallAnalysis(null); setEbayAnalysis(null);
        setScenarios([]); setActiveTab('analysis');
        setActiveAnalysisTab('ebay'); setDisplayMode('curated'); setPaginationCount(50);
        try {
            // --- UPGRADED: Pass the marketplace to the API call ---
            const response = await fetch(`${API_URL}/api/analyse?cost=${totalCost}&query=${searchTerm}&marketplace=${marketplace}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const analysisData = await response.json();
            
            setEbayListings(analysisData.listings.ebay);
            setOverallAnalysis(analysisData.analysis.overall);
            setEbayAnalysis(analysisData.analysis.ebay);
            setScenarios(analysisData.profit_scenarios);

        } catch (err) { setError('Failed to fetch data from the backend.'); console.error(err);
        } finally { setIsLoading(false); }
    };

    const handleProductSelect = (product: Product) => {
        setSearchTerm(product.name);
        setSelectedProductId(String(product.id));
        setTotalCost(product.total_cost.toFixed(2));
        setIsProductListOpen(false);
    };

    const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setSelectedProductId('');
        setIsProductListOpen(true);
    };

    const filteredProducts = workshopData.products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const openMaterialModal = (material: Material | null = null) => {
        if (material) {
            setEditingMaterial(material);
            setMaterialForm({ name: material.name, cost: String(material.cost), quantity: String(material.quantity), unit: material.unit });
        } else {
            setEditingMaterial(null);
            setMaterialForm({ name: '', cost: '', quantity: '', unit: 'g' });
        }
        setIsMaterialModalOpen(true);
    };
    const closeMaterialModal = () => { setIsMaterialModalOpen(false); setEditingMaterial(null); };
    const handleMaterialSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const materialData = { name: materialForm.name, cost: parseFloat(materialForm.cost), quantity: parseFloat(materialForm.quantity), unit: materialForm.unit };
        const url = editingMaterial ? `${API_URL}/api/materials/${editingMaterial.id}` : `${API_URL}/api/materials`;
        const method = editingMaterial ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(materialData), credentials: 'include' });
            if (!response.ok) throw new Error(`Failed to ${method} material`);
            fetchWorkshopData(); closeMaterialModal();
        } catch (err) { console.error(err); setError(`Failed to save material.`); }
    };
    const openProductModal = (product: Product | null = null) => {
        if (product) {
            setEditingProduct(product);
            setProductForm({
                name: product.name,
                recipe: product.recipe.map(r => ({ material_id: String(r.material_id), quantity: String(r.quantity) })),
                labourHours: String(product.labour_hours), hourlyRate: String(product.hourly_rate), profitMargin: String(product.profit_margin)
            });
        } else {
            setEditingProduct(null);
            setProductForm({ name: '', recipe: [{ material_id: '', quantity: '' }], labourHours: '0.5', hourlyRate: '15', profitMargin: '100' });
        }
        setIsProductModalOpen(true);
    };
    const closeProductModal = () => { setIsProductModalOpen(false); setEditingProduct(null); };
    const handleProductSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const productData = { 
            name: productForm.name, 
            recipe: productForm.recipe.filter(item => item.material_id && item.quantity).map(item => ({ material_id: parseInt(item.material_id), quantity: parseFloat(item.quantity) })),
            labour_hours: parseFloat(productForm.labourHours) || 0,
            hourly_rate: parseFloat(productForm.hourlyRate) || 0,
            profit_margin: parseFloat(productForm.profitMargin) || 100,
        };
        if (productData.name && productData.recipe.length > 0) {
            const url = editingProduct ? `${API_URL}/api/products/${editingProduct.id}` : `${API_URL}/api/products`;
            const method = editingProduct ? 'PUT' : 'POST';
            try {
                const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData), credentials: 'include' });
                if (!response.ok) throw new Error(`Failed to ${method} product`);
                fetchWorkshopData(); closeProductModal();
            } catch (err) { console.error(err); setError("Failed to save product."); }
        }
    };
    const handleDeleteMaterial = async (materialId: number) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            const response = await fetch(`${API_URL}/api/materials/${materialId}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok) throw new Error('Failed to delete material.');
            fetchWorkshopData();
        } catch (err) { console.error(err); setError('Could not delete the material.'); }
    };
    const handleDeleteProduct = async (productId: number) => {
        if (!window.confirm('Are you sure?')) return;
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
            console.error(err); setError("Could not load related items.");
            setTimeout(() => { setIsRelatedModalOpen(false); setError(''); }, 2000);
        } finally { setIsRelatedLoading(false); }
    };
    const handleRecipeChange = (index: number, field: 'material_id' | 'quantity', value: string) => {
        const updatedRecipe = [...productForm.recipe];
        updatedRecipe[index] = { ...updatedRecipe[index], [field]: value };
        setProductForm(prev => ({...prev, recipe: updatedRecipe}));
    };
    const removeRecipeItem = (index: number) => {
        const updatedRecipe = productForm.recipe.filter((_, i) => i !== index);
        if (updatedRecipe.length === 0) { setProductForm(prev => ({...prev, recipe: [{ material_id: '', quantity: '' }]}));
        } else { setProductForm(prev => ({...prev, recipe: updatedRecipe})); }
    };
    const addRecipeItem = () => { setProductForm(prev => ({...prev, recipe: [...prev.recipe, { material_id: '', quantity: '' }]})) };
    
    const sortedEbayListings = [...ebayListings].sort((a, b) => (a.price.amount / a.price.divisor) - (b.price.amount / b.price.divisor));

    return {
        user, isAuthLoading, router,
        searchTerm, setSearchTerm,
        totalCost, setTotalCost,
        isLoading, error,
        selectedProductId, setSelectedProductId,
        ebayListings,
        overallAnalysis, ebayAnalysis,
        scenarios,
        workshopData, isWorkshopLoading,
        isMaterialModalOpen, openMaterialModal, closeMaterialModal,
        materialForm, setMaterialForm, handleMaterialSubmit,
        editingMaterial,
        isProductModalOpen, openProductModal, closeProductModal,
        productForm, setProductForm, handleProductSubmit,
        handleRecipeChange, removeRecipeItem, addRecipeItem,
        editingProduct,
        handleDeleteMaterial, handleDeleteProduct,
        isRelatedModalOpen, setIsRelatedModalOpen,
        relatedItems, isRelatedLoading, selectedListingTitle,
        handleFindSimilar, 
        activeTab, setActiveTab,
        activeAnalysisTab, setActiveAnalysisTab,
        handleAnalyse,
        sortedEbayListings,
        displayMode, setDisplayMode,
        paginationCount, setPaginationCount,
        isProductListOpen, setIsProductListOpen,
        handleProductSelect, handleSearchTermChange,
        filteredProducts,
        marketplace, setMarketplace,
        currencySymbol
    };
};