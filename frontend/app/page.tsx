'use client';

import { FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useArtisanAlly } from '@/hooks/useArtisanAlly'; // <-- IMPORT THE ENGINE

// --- Type Definitions ---
type Listing = { listing_id: string | number; title: string; price: { amount: number; divisor: number; }; source: 'eBay'; };

export default function Home() {
    const {
        user, isAuthLoading, router,
        searchTerm, setSearchTerm,
        totalCost, setTotalCost, // Renamed from materialCost
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
        filteredProducts
    } = useArtisanAlly();

    // --- Create the curated and paginated lists to display ---
    let curatedList: Listing[] = [];
    if (sortedEbayListings.length > 6) {
        const lowCost = sortedEbayListings.slice(0, 2);
        const midIndex = Math.floor(sortedEbayListings.length / 2);
        const midCost = sortedEbayListings.slice(midIndex - 1, midIndex + 1);
        const highCost = sortedEbayListings.slice(-2);
        curatedList = [...lowCost, ...midCost, ...highCost];
    } else {
        curatedList = sortedEbayListings;
    }

    const paginatedList = sortedEbayListings.slice(0, paginationCount);
    const listingsToDisplay = displayMode === 'curated' ? curatedList : paginatedList;

    return (
        <>
            <Navbar />
            <main className="font-sans container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
                
                {/* --- STEP 1: WORKSHOP MANAGER --- */}
                <section className="mb-12">
                    <div className="text-center mb-4">
                        <h2 className="text-3xl font-bold text-gray-800">Step 1: Know Your Costs</h2>
                        <p className="text-lg text-gray-500 mt-2">Log in to manage your materials and product recipes to calculate your exact cost of goods.</p>
                    </div>
                    {isAuthLoading ? ( <p className="text-center text-gray-500 py-8">Loading user session...</p> ) : !user ? (
                        <div className="text-center text-gray-500 py-8 px-4 bg-white rounded-lg shadow-md">
                            <h3 className="text-2xl font-bold text-gray-800">Welcome to the Workshop Manager!</h3>
                            <p className="mt-4">Please <Link href="/login" className="text-indigo-600 font-semibold hover:underline">log in</Link> or <Link href="/register" className="text-indigo-600 font-semibold hover:underline">register</Link> to access your private workshop.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* --- PRODUCTS & RECIPES COLUMN --- */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-semibold text-gray-700">Your Products & Recipes</h3>
                                    <button onClick={() => openProductModal(null)} disabled={workshopData.materials.length === 0} className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">New Product</button>
                                </div>
                                {isWorkshopLoading ? <p className="text-center py-4">Loading...</p> : workshopData.products.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8 px-4 bg-white rounded-lg shadow-md"><p>No products yet.</p><p className="text-sm mt-2">Add materials first, then click "New Product" to create a recipe and calculate its cost.</p></div>
                                ) : (
                                    <div className="space-y-4">
                                        {workshopData.products.map(p => (
                                            <div key={p.id} className="bg-white p-5 rounded-lg shadow-md border relative">
                                                <div className="absolute top-2 right-2 flex gap-2">
                                                    <button onClick={() => openProductModal(p)} className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200">Edit</button>
                                                    <button onClick={() => handleDeleteProduct(p.id)} className="px-2 py-1 text-xs font-bold text-red-500 bg-red-100 rounded-full hover:bg-red-200 hover:text-red-700" title="Delete Product">X</button>
                                                </div>
                                                <h4 className="text-lg font-semibold text-gray-900">{p.name}</h4>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    <div className="flex justify-between"><span>Material Cost (COGS):</span> <span className="font-medium">£{p.material_cost.toFixed(2)}</span></div>
                                                    <div className="flex justify-between"><span>Labour ({p.labour_hours} hr @ £{p.hourly_rate}/hr):</span> <span className="font-medium">£{p.labour_cost.toFixed(2)}</span></div>
                                                </div>
                                                <div className="mt-2 pt-2 border-t flex justify-between text-gray-900">
                                                    <span className="font-bold">Total Cost to Make:</span>
                                                    <span className="font-bold">£{p.total_cost.toFixed(2)}</span>
                                                </div>
                                                <div className="mt-2 pt-2 border-t flex justify-between text-blue-600">
                                                    <span className="font-bold">Suggested Price ({p.profit_margin}% Margin):</span>
                                                    <span className="font-bold text-lg">£{p.suggested_price.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* --- MATERIALS INVENTORY COLUMN --- */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-semibold text-gray-700">Your Materials Inventory</h3>
                                    <button onClick={() => openMaterialModal(null)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">
                                        Add Material
                                    </button>
                                </div>
                                {isWorkshopLoading ? <p className="text-center py-4">Loading...</p> : workshopData.materials.length === 0 ? (<p className="text-center text-gray-500 py-4">Start by adding your raw materials.</p>) : (
                                    <div className="bg-white p-4 rounded-lg shadow-md"><ul className="divide-y divide-gray-200">{workshopData.materials.map(m=>(
                                        <li key={m.id} className="py-3 flex justify-between items-center gap-4 text-sm">
                                            <div className="flex-1"><p className="font-semibold text-gray-800">{m.name}</p><p className="text-gray-500">£{m.cost.toFixed(2)} for {m.quantity} {m.unit} = <span className="font-semibold text-gray-700">£{m.cost_per_unit?.toFixed(4)} per {m.unit}</span></p></div>
                                            <div className="flex gap-2">
                                                <button onClick={() => openMaterialModal(m)} className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200">Edit</button>
                                                <button onClick={() => handleDeleteMaterial(m.id)} className="px-2 py-1 text-xs font-bold text-red-500 bg-red-100 rounded-full hover:bg-red-200 hover:text-red-700" title="Delete Material">X</button>
                                            </div>
                                        </li>))}
                                    </ul></div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                <hr className="my-12 border-t-2 border-gray-200" />

                {/* --- STEP 2: ANALYSIS INPUT (UPGRADED) --- */}
                <section className="mb-12">
                    <div className="text-center mb-4">
                        <h2 className="text-3xl font-bold text-gray-800">Step 2: Analyse The Market</h2>
                        <p className="text-lg text-gray-500 mt-2">Find your optimal price. Select a product from your workshop or enter your cost manually.</p>
                    </div>
                    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            {/* --- NEW: Smart Search Combobox --- */}
                            <div className="relative">
                                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">1. Enter or Select Product to Analyse</label>
                                <input 
                                    type="text" 
                                    id="searchTerm" 
                                    value={searchTerm} 
                                    onChange={handleSearchTermChange}
                                    onFocus={() => setIsProductListOpen(true)}
                                    onBlur={() => setTimeout(() => setIsProductListOpen(false), 200)} // Delay to allow click
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                />
                                {isProductListOpen && user && filteredProducts.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        <ul className="divide-y divide-gray-200">
                                            {filteredProducts.map(product => (
                                                <li 
                                                    key={product.id} 
                                                    onMouseDown={() => handleProductSelect(product)} // Use onMouseDown to fire before blur
                                                    className="p-3 hover:bg-gray-100 cursor-pointer"
                                                >
                                                    <p className="font-semibold">{product.name}</p>
                                                    <p className="text-sm text-gray-600">Your Cost: £{product.total_cost.toFixed(2)}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            {/* --- Total Cost Input --- */}
                            <div>
                                <label htmlFor="totalCost" className="block text-sm font-medium text-gray-700">2. Your Total Cost to Make (£)</label>
                                <input 
                                    type="number" 
                                    id="totalCost" 
                                    value={totalCost} 
                                    placeholder="Select a product or enter cost" 
                                    onChange={(e) => { setTotalCost(e.target.value); setSelectedProductId(''); }} 
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                                />
                            </div>
                        </div>
                        <button onClick={handleAnalyse} disabled={isLoading} className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
                            {isLoading ? 'Analysing...' : 'Analyse Market'}
                        </button>
                    </div>
                </section>
        
                {error && <p className="text-center text-red-500 mt-4 font-semibold">{error}</p>}
        
                {/* --- STEP 3 & 4: ANALYSIS RESULTS --- */}
                {overallAnalysis && (
                    <div className="max-w-5xl mx-auto space-y-12">
                        {/* --- STEP 3: PROFIT SCENARIOS --- */}
                        <section>
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-800">Step 3: See Your Profit Scenarios</h2>
                                <p className="text-md text-gray-500 mt-2">Calculated using your total cost of <span className="font-semibold">£{parseFloat(totalCost).toFixed(2)}</span> against the eBay market average of <span className="font-semibold">£{overallAnalysis.average_price.toFixed(2)}</span>.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {scenarios.map((s)=>(
                                    <div key={s.name} className="bg-white p-6 rounded-lg shadow-md border text-center">
                                        <h3 className="font-semibold text-gray-800">{s.name}</h3>
                                        <p className="text-sm text-gray-500">Set Price at:</p>
                                        <p className="text-3xl font-bold text-gray-900 my-2">£{s.price.toFixed(2)}</p>
                                        <p className="text-xl text-green-600">£{s.profit.toFixed(2)}</p>
                                        <p className="text-sm text-gray-500">Estimated Profit</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <hr className="my-12 border-t-2 border-gray-200" />

                        {/* --- STEP 4: MARKET ANALYSIS --- */}
                        <section>
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-800">Step 4: View Your Competition</h2>
                            </div>
                            <div className="border-b border-gray-200">
                                <nav className="-mb-px flex gap-6" aria-label="Platform Tabs">
                                    <button onClick={() => setActiveAnalysisTab('ebay')} className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeAnalysisTab === 'ebay' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>eBay Analysis</button>
                                </nav>
                            </div>
                            <div className="mt-8">
                                {activeAnalysisTab === 'ebay' && ebayAnalysis && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center"><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Listings Found</p><p className="text-xl font-bold text-gray-800">{ebayAnalysis.count}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Average Price</p><p className="text-xl font-bold text-blue-600">£{ebayAnalysis.average_price.toFixed(2)}</p></div><div className="bg-white p-4 rounded-lg shadow-sm border"><p className="text-sm text-gray-500">Price Range</p><p className="text-xl font-bold text-gray-800">£{ebayAnalysis.min_price.toFixed(2)} - £{ebayAnalysis.max_price.toFixed(2)}</p></div></div>
                                        <div>
                                            <h3 className="text-xl font-semibold text-gray-700 mb-4">
                                                eBay Listings {displayMode === 'curated' ? '(Price Snapshot)' : '(Sorted by Price)'}
                                            </h3>
                                            <div className="bg-white p-4 rounded-lg shadow-md">
                                                <ul className="divide-y divide-gray-200">
                                                    {listingsToDisplay.map((l)=>(<li key={`eBay-${l.listing_id}`} className="py-3 flex justify-between items-center gap-2"><p className="text-gray-800 text-sm flex-1">{l.title}</p><span className="font-semibold text-gray-800 w-16 text-right">£{(l.price.amount / l.price.divisor).toFixed(2)}</span><button onClick={()=>handleFindSimilar(l.listing_id,l.title)} className="p-2 rounded-full hover:bg-gray-200" title="Find similar items on eBay"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button></li>))}
                                                </ul>
                                                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-center">
                                                    {displayMode === 'curated' && sortedEbayListings.length > 6 && (
                                                        <button onClick={() => setDisplayMode('full')} className="text-indigo-600 font-semibold hover:underline">
                                                            Show All {sortedEbayListings.length} Items (Sorted by Price)
                                                        </button>
                                                    )}
                                                    {displayMode === 'full' && paginationCount < sortedEbayListings.length && (
                                                        <button onClick={() => setPaginationCount(prev => prev + 50)} className="text-indigo-600 font-semibold hover:underline">
                                                            Show More Items
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
        
                {/* --- MATERIAL MODAL --- */}
                {isMaterialModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingMaterial ? 'Edit Material' : 'Add a New Material'}</h2>
                            <form onSubmit={handleMaterialSubmit} className="space-y-4">
                                <input type="text" placeholder="e.g., Jesmonite AC100 Powder" value={materialForm.name} onChange={e=>setMaterialForm({...materialForm, name: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                <div className="grid grid-cols-3 gap-4">
                                    <input type="number" placeholder="Total Cost (£)" step="0.01" value={materialForm.cost} onChange={e=>setMaterialForm({...materialForm, cost: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                    <input type="number" placeholder="Total Qty (e.g., 5000)" value={materialForm.quantity} onChange={e=>setMaterialForm({...materialForm, quantity: e.target.value})} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                                    <select value={materialForm.unit} onChange={e=>setMaterialForm({...materialForm, unit: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"><option value="g">grams (g)</option><option value="ml">milliliters (ml)</option><option value="unit">units</option><option value="pieces">pieces</option></select>
                                </div>
                                <div className="flex justify-end gap-4 mt-8">
                                    <button type="button" onClick={closeMaterialModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">{editingMaterial ? 'Save Changes' : 'Add Material'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                {/* --- PRODUCT MODAL (UPGRADED) --- */}
                {isProductModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingProduct ? 'Edit Product Recipe' : 'Create a New Product Recipe'}</h2>
                            
                            <form onSubmit={handleProductSubmit}>
                                <div className="space-y-6">
                                    <div>
                                        <label htmlFor="productName" className="block text-sm font-medium text-gray-700">1. Product Name</label>
                                        <input type="text" id="productName" placeholder="e.g., Sage Green Tray" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"/>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">2. Recipe Ingredients</h3>
                                        <p className="text-xs text-gray-500 mb-4">Choose from your materials inventory. The quantity should be in the base unit (e.g., 'g' or 'ml') defined for the material.</p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                            {productForm.recipe.map((item, index) => {
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
                                        <button type="button" onClick={addRecipeItem} className="mt-4 text-sm text-blue-600 hover:underline">Add Ingredient</button>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">3. Labour Costs</h3>
                                        <div className="flex gap-4">
                                            <div className="w-1/2">
                                                <label htmlFor="labourHours" className="block text-sm font-medium text-gray-700">Total Hours</label>
                                                <input type="number" id="labourHours" placeholder="e.g., 0.5" step="0.1" value={productForm.labourHours} onChange={e => setProductForm({...productForm, labourHours: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"/>
                                            </div>
                                            <div className="w-1/2">
                                                <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">Rate per Hour (£)</label>
                                                <input type="number" id="hourlyRate" placeholder="e.g., 15.00" step="0.01" value={productForm.hourlyRate} onChange={e => setProductForm({...productForm, hourlyRate: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"/>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">4. Desired Profit Margin</h3>
                                        <label htmlFor="profitMargin" className="block text-sm font-medium text-gray-700">Profit Margin (%)</label>
                                        <input type="number" id="profitMargin" placeholder="e.g., 100" step="1" value={productForm.profitMargin} onChange={e => setProductForm({...productForm, profitMargin: e.target.value})} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"/>
                                        <p className="text-xs text-gray-500 mt-1">A 100% margin means you are doubling your total cost.</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 mt-8">
                                    <button type="button" onClick={closeProductModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">{editingProduct ? 'Save Changes' : 'Save Product'}</button>
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