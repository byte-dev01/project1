import './styles.css'
import {
	useQuery,
	useQueryClient,
	queryClient,
	useMutation
} from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import Post from './Post'
import client from './react-query-client'

function Button() {
	// First query
	const helloQuery = useQuery({
		queryKey: ['hello world'],
		queryFn: () => Promise.resolve('5')
	})

	const one = useQuery({
		queryKey: ['one'],
		queryFn: () =>
			fetch('https://jsonplaceholder.typicode.com/todos/2').then((res) =>
				res.json()
			)
	})
	// Second query with delay
	const { data, error, isLoading, isError, isSuccess, isIdle } = useQuery({
		queryKey: ['hello-world'],
		queryFn: () =>
			new Promise((resolve) => {
				setTimeout(() => {
					resolve(Math.random(), '⏳ Delayed response after 1 second')
				}, 5000)
			})
	})
	const status = useMemo(() => ({ status: 'ok' }), [])

	console.log('Data:', data)
	console.log('Error:', error)
	return <button>I am button{data}</button>
}
function MyComponent() {
	const name = 'todos' // e.g., API endpoint
	const id = 1 // item ID
	const status = 'ok' // status filter

	const { data, error, isLoading, isError } = useQuery({
		queryKey: [name, id, status],
		queryFn: ({ queryKey }) => {
			const [name, id, status] = queryKey

			return fetch(
				`https://jsonplaceholder.typicode.com/${name}/${id}?status=${status}`
			).then((res) => {
				if (!res.ok) throw new Error('Network response was not ok')
				return res.json()
			})
		}
	})

	if (isLoading) return <p>Loading...</p>
	if (isError) return <p>Error: {error.message}</p>

	return (
		<div>
			<h2>Fetched Result</h2>
			<p>ID: {data.id}</p>
			<p>Title: {data.title}</p>
			<p>Status Sent: {status}</p>
		</div>
	)
}

function App2() {
	const [state, setState] = useState(false)
	const fetcher = ({ queryKey }) => {
		const [, repo] = queryKey // skip "delayed-fetch", get the actual repo name
		return fetch(`https://api.github.com/repos/${repo}`).then((res) => {
			if (!res.ok) throw new Error('Network error')
			return res.json()
		})
	}
	const [repoName, setRepoName] = useState('facebook/react')

	const { data, isFetching } = useQuery({
		queryKey: ['delayed-fetch', repoName], // pass actual repo name here
		queryFn: fetcher,
		enabled: state // only fetches when state is true
	})

	return (
		<div>
			<button onClick={() => setState((c) => !c)}>
				Click me to toggle fetch
			</button>
			<input
				type="text"
				value={repoName}
				onChange={(e) => setRepoName(e.target.value)}
			/>
			{isFetching && <p>Loading...</p>}
			{data && (
				<div>
					<h1>{data.name}</h1>
					<li>{data.description}</li>

					<p>
						<strong>{data.full_name}</strong>
					</p>
					<p>{data.description}</p>
					<p>⭐ {data.stargazers_count} stars</p>
				</div>
			)}
		</div>
	)
}

const fetchPosts = async () => {
	const res = await fetch('https://jsonplaceholder.typicode.com/posts')
	if (!res.ok) throw new Error('Network response was not ok')
	return res.json()
}

function Posts() {
	const [postID, setPostId] = useState(null)
	const [visitedIds, setVisitedIds] = useState([])
	const queryClient = useQueryClient()

	const {
		data: posts,
		isLoading,
		error
	} = useQuery({
		queryKey: ['posts'], // ✅ array key for React Query v5
		queryFn: fetchPosts
	})

	// ✅ Correct way to mutate a post title inside cached array
	const mutateTitle = (id) => {
		queryClient.setQueryData(['post', id], (old) =>
			old ? { ...old, title: 'boom boom mutated' } : old
		)
	}

	if (isLoading) return <p>Loading...</p>
	if (error) return <p>Error: {error.message}</p>

	if (postID !== null) {
		// Assume you have a Post component elsewhere
		return <Post postID={postID} goBack={() => setPostId(null)} />
	}

	return (
		<div>
			{posts.map((post) => {
				const visited = visitedIds.includes(post.id)
				return (
					<p key={post.id}>
						<b>{visited ? 'visited' : ''}</b>{' '}
						<a
							href="#"
							onClick={(e) => {
								e.preventDefault()
								setPostId(post.id)
								setVisitedIds((prev) =>
									prev.includes(post.id)
										? prev
										: [...prev, post.id]
								)
								const fullPost = queryClient
									.getQueryData(['posts'])
									?.find((p) => p.id === post.id)
								console.log('Clicked post:', fullPost)
							}}
						>
							{post.id} - {post.title}
						</a>{' '}
						<button onClick={() => mutateTitle(post.id)}>
							Mutate Title
						</button>
					</p>
				)
			})}
		</div>
	)
}

const timer = (duration, para) => {
	console.log('I WAS RUNNN!!!')
	return new Promise((resolve, reject) => {
		console.log({ para }) // ✅ this now runs
		setTimeout(() => resolve('yoooo'), duration) // ✅ fixed: added delay
	})
}
const API_BASE = 'https://1337-yourusername-yourproject.codedamn.app'

const fetcher = (url, body) =>
	fetch(`${API_BASE}${url}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	})

function App4() {
	const mutation = useMutation({
		mutationFn: (body) => fetcher('/api/get-records', body),
		onSuccess: (data) => {
			console.log('got response from backend!', { data })
		},
		onError: (error) => {
			console.log('got error from backend', error)
		}
	})

	const {
		data: favLangs,
		isLoading,
		isError
	} = useQuery({
		queryKey: ['favLangs'],
		queryFn: () =>
			fetch(`${API_BASE}/api/get-records`).then((res) => res.json()),
		select: (data) => data
	})

	async function callMutation() {
		try {
			await mutation.mutateAsync({ record: 'typescript' })
			console.log('post updated')
		} catch (err) {
			console.log('Caught in callMutation:', err)
		}
	}

	return (
		<div className="App">
			<h1>Some fav languages</h1>
			{isLoading && <p>Loading...</p>}
			{isError && <p>Error loading languages</p>}
			{favLangs?.lan?.map((lan) => (
				<li key={lan}>{lan}</li>
			))}
			<p onClick={callMutation} style={{ cursor: 'pointer' }}>
				Submit
			</p>
		</div>
	)
}

export default App4

function App5() {
	const [visible, setVisible] = useState(true)
	function toggleButton() {
		setVisible((visible) => !visible)
	}
	return (
		<div className="App">
			<h1>Hello CodeSandbox</h1>
			<h2>Start editing to see some magic happen!</h2>
			<button onClick={toggleButton}>Toggle Button Visibility</button>
			{visible && <Button />}
			<p>Status</p>
		</div>
	)
}

function App() {
	const [data, setData] = useState([])

	useEffect(() => {
		axios
			.get('https://jsonplaceholder.typicode.com/todos/1')
			.then((response) => {
				setData(response.data)
			})
			.catch((error) => {
				console.log(error)
			})
	}, [])
	return <>{JSON.stringify(data)}</>
}
