'use client';
import { deleteReport } from './actions';
export default function ConfirmDelete({id}:{id:string}){return <form action={deleteReport} onSubmit={e=>{if(!window.confirm('Supprimer définitivement ce rapport et ses médias ?'))e.preventDefault();}}><input type="hidden" name="id" value={id}/><button className="danger">Supprimer</button></form>}
