import React from 'react'

const HMenuOptions = ({setShowHMenuOptions}) => {
  return (
    <div className='hMenuOptionsContainer'>
        <div className='hMenuOptionsContainer__close'>
            <div onClick={()=>setShowHMenuOptions(false)} className='hMenuOptionsContainer__close__prop'>X</div>
        </div>
        <div className='hMenuOptionsContainer__items'>
            <a className='hMenuOptionsContainer__items__item' href="#packs">PACKS</a>{" "}
            <a className='hMenuOptionsContainer__items__item' href="#opiniones">OPINIONES</a>{" "}
            <a className='hMenuOptionsContainer__items__item' href="#faq">FAQ</a>{" "}
            <a className='hMenuOptionsContainer__items__item' href="/buscar">BUSCAR MI PEDIDO</a>{" "}
            <a className='hMenuOptionsContainer__items__item' href="/mis-pedidos-online">MIS PEDIDOS</a>
        </div>
    </div>
  )
}

export default HMenuOptions